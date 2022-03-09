/**
 * @module ol/render/webgl/PolygonBatchRenderer
 */
import {AttributeType} from '../../webgl/Helper.js';
import {transform2D} from '../../geom/flat/transform.js';
import AbstractBatchRenderer from './BatchRenderer.js';

class PolygonBatchRenderer extends AbstractBatchRenderer {
  /**
   * @param {import("../../webgl/Helper.js").default} helper
   * @param {Worker} worker
   * @param {string} vertexShader
   * @param {string} fragmentShader
   * @param {Array<import('./BatchRenderer.js').CustomAttribute>} customAttributes
   */
  constructor(helper, worker, vertexShader, fragmentShader, customAttributes) {
    super(helper, worker, vertexShader, fragmentShader, customAttributes);

    // By default only a position attribute is required to render polygons
    this.attributes_ = [
      {
        name: 'a_position',
        size: 2,
        type: AttributeType.FLOAT,
      },
    ].concat(
      customAttributes.map(function (attribute) {
        return {
          name: 'a_' + attribute.name,
          size: 1,
          type: AttributeType.FLOAT,
        };
      })
    );
  }

  /**
   * Render instructions for polygons are structured like so:
   * [ customAttr0, ..., customAttrN, numberOfRings, numberOfVerticesInRing0, ..., numberOfVerticesInRingN, x0, y0, ..., xN, yN, numberOfRings,... ]
   * @param {import("./MixedGeometryBatch.js").PolygonGeometryBatch} batch
   * @override
   */
  generateRenderInstructions_(batch) {
    // here we anticipate the amount of render instructions for polygons:
    // 2 instructions per vertex for position (x and y)
    // + 1 instruction per polygon per custom attributes
    // + 1 instruction per polygon (for vertices count in polygon)
    // + 1 instruction per ring (for vertices count in ring)
    const totalInstructionsCount =
      2 * batch.verticesCount +
      (1 + this.customAttributes_.length) * batch.geometriesCount +
      batch.ringsCount;
    if (
      !batch.renderInstructions ||
      batch.renderInstructions.length !== totalInstructionsCount
    ) {
      batch.renderInstructions = new Float32Array(totalInstructionsCount);
    }

    // loop on features to fill the render instructions
    let batchEntry;
    const flatCoords = [];
    let renderIndex = 0;
    let value;
    for (const featureUid in batch.entries) {
      batchEntry = batch.entries[featureUid];
      for (let i = 0, ii = batchEntry.flatCoordss.length; i < ii; i++) {
        flatCoords.length = batchEntry.flatCoordss[i].length;
        transform2D(
          batchEntry.flatCoordss[i],
          0,
          flatCoords.length,
          2,
          batch.renderInstructionsTransform,
          flatCoords
        );

        // custom attributes
        for (let k = 0, kk = this.customAttributes_.length; k < kk; k++) {
          value = this.customAttributes_[k].callback(
            batchEntry.feature,
            batchEntry.properties
          );
          batch.renderInstructions[renderIndex++] = value;
        }

        // ring count
        batch.renderInstructions[renderIndex++] =
          batchEntry.ringsVerticesCounts[i].length;

        // vertices count in each ring
        for (
          let j = 0, jj = batchEntry.ringsVerticesCounts[i].length;
          j < jj;
          j++
        ) {
          batch.renderInstructions[renderIndex++] =
            batchEntry.ringsVerticesCounts[i][j];
        }

        // looping on points for positions
        for (let j = 0, jj = flatCoords.length; j < jj; j += 2) {
          batch.renderInstructions[renderIndex++] = flatCoords[j];
          batch.renderInstructions[renderIndex++] = flatCoords[j + 1];
        }
      }
    }
  }
}

export default PolygonBatchRenderer;
