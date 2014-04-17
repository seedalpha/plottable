///<reference path="../reference.ts" />

module Plottable {
  export class BarRenderer extends XYRenderer {
    private baseline: D3.Selection;
    private _baselineValue = 0;
    private _barAlignment = "left";

    /**
     * Creates a BarRenderer.
     *
     * @constructor
     * @param {IDataset} dataset The dataset to render.
     * @param {Scale} xScale The x scale to use.
     * @param {QuantitiveScale} yScale The y scale to use.
     * @param {IAccessor|string|number} [xAccessor] An accessor for extracting
     *     the start position of each bar from the data.
     * @param {IAccessor|string|number} [widthAccessor] An accessor for extracting
     *     the width of each bar, in pixels, from the data.
     * @param {IAccessor|string|number} [yAccessor] An accessor for extracting
     *     the height of each bar from the data.
     */
    constructor(dataset: any,
            xScale: Scale,
            yScale: QuantitiveScale,
            xAccessor?: IAccessor,
            widthAccessor?: IAccessor,
            yAccessor?: IAccessor) {
      super(dataset, xScale, yScale, xAccessor, yAccessor);
      this.classed("bar-renderer", true);
      this._animate = true;
      this.project("width", 10);
    }

    public _paint() {
      super._paint();
      var scaledBaseline = this.yScale.scale(this._baselineValue);

      var xA = Utils.applyAccessor(this._xAccessor, this.dataSource());

      this.dataSelection = this.renderArea.selectAll("rect").data(this._dataSource.data(), xA);
      this.dataSelection.enter().append("rect");

      var attrToProjector = this._generateAttrToProjector();

      var xF = attrToProjector["x"];
      var widthF = attrToProjector["width"];

      var rangeType = "points";
      var castXScale = (<OrdinalScale> this.xScale);
      if (castXScale.rangeType != null) {
        rangeType = castXScale.rangeType();
      }

      if (rangeType === "points") {
        if (this._barAlignment === "center") {
          attrToProjector["x"] = (d: any, i: number) => xF(d, i) - widthF(d, i) / 2;
        } else if (this._barAlignment === "right") {
          attrToProjector["x"] = (d: any, i: number) => xF(d, i) - widthF(d, i);
        }
      } else {
        attrToProjector["width"] = (d: any, i: number) => castXScale.rangeBand();
      }

      var yFunction = attrToProjector["y"];

      attrToProjector["y"] = (d: any, i: number) => {
        var originalY = yFunction(d, i);
        return (originalY > scaledBaseline) ? scaledBaseline : originalY;
      }

      var heightFunction = (d: any, i: number) => {
        return Math.abs(scaledBaseline - yFunction(d, i));
      };
      attrToProjector["height"] = heightFunction;

      if (attrToProjector["fill"] != null) {
        this.dataSelection.attr("fill", attrToProjector["fill"]); // so colors don't animate
      }

      if (this.baseline == null) {
        this.baseline = this.renderArea.append("line").classed("baseline", true);
      }

      var updateSelection: any = this.dataSelection;
      var baseline: any = this.baseline;
      if (this._animate) {
        updateSelection = updateSelection.transition();
        baseline = baseline.transition();
      }

      updateSelection.attr(attrToProjector);
      this.dataSelection.exit().remove();

      baseline.attr("x1", 0).attr("x2", this.availableWidth)
                   .attr("y1", scaledBaseline).attr("y2", scaledBaseline);
    }

    /**
     * Sets the baseline for the bars to the specified value.
     *
     * @param {number} value
     * @return {BarRenderer} The calling BarRenderer.
     */
    public baselineValue(value: number) {
      this._baselineValue = value;
      if (this.element != null) {
        this._render();
      }
      return this;
    }

    /**
     * Sets the horizontal alignment of the bars.
     *
     * @param {string} alignment Which part of the bar should align with the bar's x-value (left/center/right).
     * @return {BarRenderer} The calling BarRenderer.
     */
    public barAlignment(alignment: string) {
      var alignmentLC = alignment.toLowerCase();
      if (alignmentLC !== "left" && alignmentLC !== "center" && alignmentLC !== "right") {
        throw new Error("unsupported bar alignment");
      }

      this._barAlignment = alignmentLC;
      if (this.element != null) {
        this._render();
      }
      return this;
    }

    /**
     * Selects the bar under the given pixel position.
     *
     * @param {number} x The pixel x position.
     * @param {number} y The pixel y position.
     * @param {boolean} [select] Whether or not to select the bar (by classing it "selected");
     * @return {D3.Selection} The selected bar, or null if no bar was selected.
     */
    public selectBar(x: number, y: number, select = true): D3.Selection {
      var selectedBar: D3.Selection = null;

      this.dataSelection.each(function(d: any) {
        var bbox = this.getBBox();
        if (bbox.x <= x && x <= bbox.x + bbox.width &&
            bbox.y <= y && y <= bbox.y + bbox.height) {
          selectedBar = d3.select(this);
        }
      });

      if (selectedBar != null) {
        selectedBar.classed("selected", select);
      }

      return selectedBar;
    }

    /**
     * Deselects all bars.
     * @return {BarRenderer} The calling BarRenderer.
     */
    public deselectAll() {
      this.dataSelection.classed("selected", false);
      return this;
    }
  }
}
