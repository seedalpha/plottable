///<reference path="../../reference.ts" />

module Plottable {

type LabelConfig = {
  labelArea: D3.Selection;
  measurer: SVGTypewriter.Measurers.Measurer;
  writer: SVGTypewriter.Writers.Writer;
};

export module Plots {
  export class Bar<X, Y> extends XYPlot<X, Y> {
    public static ORIENTATION_VERTICAL = "vertical";
    public static ORIENTATION_HORIZONTAL = "horizontal";
    protected static _DEFAULT_WIDTH = 10;
    private static _BAR_WIDTH_RATIO = 0.95;
    private static _SINGLE_BAR_DIMENSION_RATIO = 0.4;
    private static _LABEL_AREA_CLASS = "bar-label-text-area";
    private static _LABEL_VERTICAL_PADDING = 5;
    private static _LABEL_HORIZONTAL_PADDING = 5;
    private _baseline: D3.Selection;
    private _baselineValue: number;
    protected _isVertical: boolean;
    private _labelFormatter: Formatter = Formatters.identity();
    private _labelsEnabled = false;
    private _hideBarsIfAnyAreTooWide = true;
    private _labelConfig: Utils.Map<Dataset, LabelConfig>;

    /**
     * @constructor
     * @param {Scale} xScale The x scale to use.
     * @param {Scale} yScale The y scale to use.
     * @param {string} [orientation="vertical"] One of "vertical"/"horizontal".
     */
    constructor(orientation = Bar.ORIENTATION_VERTICAL) {
      super();
      this.classed("bar-plot", true);
      if (orientation !== Bar.ORIENTATION_VERTICAL && orientation !== Bar.ORIENTATION_HORIZONTAL) {
        throw new Error(orientation + " is not a valid orientation for Plots.Bar");
      }
      this._isVertical = orientation === Bar.ORIENTATION_VERTICAL;
      this.animator("baseline", new Animators.Null());
      this.baselineValue(0);
      this.attr("fill", new Scales.Color().range()[0]);
      this.attr("width", () => this._getBarPixelWidth());
      this._labelConfig = new Utils.Map<Dataset, LabelConfig>();
    }

    public x(): Plots.AccessorScaleBinding<X, number>;
    public x(x: number | Accessor<number>): Bar<X, Y>;
    public x(x: X | Accessor<X>, xScale: Scale<X, number>): Bar<X, Y>;
    public x(x?: number | Accessor<number> | X | Accessor<X>, xScale?: Scale<X, number>): any {
      if (x == null) {
        return super.x();
      }

      if (xScale == null) {
        super.x(<number | Accessor<number>>x);
      } else {
        super.x(< X | Accessor<X>>x, xScale);
      }

      this._updateValueScale();
      return this;
    }

    public y(): Plots.AccessorScaleBinding<Y, number>;
    public y(y: number | Accessor<number>): Bar<X, Y>;
    public y(y: Y | Accessor<Y>, yScale: Scale<Y, number>): Bar<X, Y>;
    public y(y?: number | Accessor<number> | Y | Accessor<Y>, yScale?: Scale<Y, number>): any {
      if (y == null) {
        return super.y();
      }

      if (yScale == null) {
        super.y(<number | Accessor<number>>y);
      } else {
        super.y(<Y | Accessor<Y>>y, yScale);
      }

      this._updateValueScale();
      return this;
    }

    protected _getDrawer(dataset: Dataset) {
      return new Plottable.Drawers.Rectangle(dataset);
    }

    protected _setup() {
      super._setup();
      this._baseline = this._renderArea.append("line").classed("baseline", true);
    }

    /**
     * Gets the baseline value.
     * The baseline is the line that the bars are drawn from.
     *
     * @returns {number}
     */
    public baselineValue(): number;
    /**
     * Sets the baseline value.
     * The baseline is the line that the bars are drawn from.
     *
     * @param {number} value
     * @returns {Bar} The calling Bar Plot.
     */
    public baselineValue(value: number): Bar<X, Y>;
    public baselineValue(value?: number): any {
      if (value == null) {
        return this._baselineValue;
      }
      this._baselineValue = value;
      this._updateValueScale();
      this.render();
      return this;
    }

    /**
     * Get whether bar labels are enabled.
     *
     * @returns {boolean} Whether bars should display labels or not.
     */
    public labelsEnabled(): boolean;
    /**
     * Sets whether labels are enabled.
     *
     * @param {boolean} labelsEnabled
     * @returns {Bar} The calling Bar Plot.
     */
    public labelsEnabled(enabled: boolean): Bar<X, Y>;
    public labelsEnabled(enabled?: boolean): any {
      if (enabled === undefined) {
        return this._labelsEnabled;
      } else {
        this._labelsEnabled = enabled;
        this.render();
        return this;
      }
    }

    /**
     * Gets the Formatter for the labels.
     */
    public labelFormatter(): Formatter;
    /**
     * Sets the Formatter for the labels.
     *
     * @param {Formatter} formatter
     * @returns {Bar} The calling Bar Plot.
     */
    public labelFormatter(formatter: Formatter): Bar<X, Y>;
    public labelFormatter(formatter?: Formatter): any {
      if (formatter == null) {
        return this._labelFormatter;
      } else {
        this._labelFormatter = formatter;
        this.render();
        return this;
      }
    }

    protected _setupDatasetNodes(dataset: Dataset) {
      super._setupDatasetNodes(dataset);
      var labelArea = this._renderArea.append("g").classed(Bar._LABEL_AREA_CLASS, true);
      var measurer = new SVGTypewriter.Measurers.CacheCharacterMeasurer(labelArea);
      var writer = new SVGTypewriter.Writers.Writer(measurer);
      this._labelConfig.set(dataset, { labelArea: labelArea, measurer: measurer, writer: writer });
    }

    protected _removeDatasetNodes(dataset: Dataset) {
      super._removeDatasetNodes(dataset);
      var labelConfig = this._labelConfig.get(dataset);
      if (labelConfig != null) {
        labelConfig.labelArea.remove();
        this._labelConfig.delete(dataset);
      }
    }

    /**
     * Returns the Entity nearest to the query point according to the following algorithm:
     *   - If the query point is inside a bar, returns the Entity for that bar.
     *   - Otherwise, gets the nearest Entity by the primary direction (X for vertical, Y for horizontal),
     *     breaking ties with the secondary direction.
     * Returns undefined if no Entity can be found.
     *
     * @param {Point} queryPoint
     * @returns {Plots.Entity} The nearest Entity, or undefined if no Entity can be found.
     */
    public entityNearest(queryPoint: Point): Plots.Entity {
      var minPrimaryDist = Infinity;
      var minSecondaryDist = Infinity;

      var queryPtPrimary = this._isVertical ? queryPoint.x : queryPoint.y;
      var queryPtSecondary = this._isVertical ? queryPoint.y : queryPoint.x;

      // SVGRects are positioned with sub-pixel accuracy (the default unit
      // for the x, y, height & width attributes), but user selections (e.g. via
      // mouse events) usually have pixel accuracy. We add a tolerance of 0.5 pixels.
      var tolerance = 0.5;

      var closest: Plots.Entity;
      this.entities().forEach((entity) => {
        if (!this._isVisibleOnPlot(entity.datum, entity.position, entity.selection)) {
          return;
        }
        var primaryDist = 0;
        var secondaryDist = 0;
        var plotPt = entity.position;
        // if we're inside a bar, distance in both directions should stay 0
        var barBBox = Utils.DOM.getBBox(entity.selection);
        if (!Utils.Methods.intersectsBBox(queryPoint.x, queryPoint.y, barBBox, tolerance)) {
          var plotPtPrimary = this._isVertical ? plotPt.x : plotPt.y;
          primaryDist = Math.abs(queryPtPrimary - plotPtPrimary);

          // compute this bar's min and max along the secondary axis
          var barMinSecondary = this._isVertical ? barBBox.y : barBBox.x;
          var barMaxSecondary = barMinSecondary + (this._isVertical ? barBBox.height : barBBox.width);

          if (queryPtSecondary >= barMinSecondary - tolerance && queryPtSecondary <= barMaxSecondary + tolerance) {
            // if we're within a bar's secondary axis span, it is closest in that direction
            secondaryDist = 0;
          } else {
            var plotPtSecondary = this._isVertical ? plotPt.y : plotPt.x;
            secondaryDist = Math.abs(queryPtSecondary - plotPtSecondary);
          }
        }
        // if we find a closer bar, record its distance and start new closest lists
        if (primaryDist < minPrimaryDist
            || primaryDist === minPrimaryDist && secondaryDist < minSecondaryDist) {
          closest = entity;
          minPrimaryDist = primaryDist;
          minSecondaryDist = secondaryDist;
        }
      });

      return closest;
    }

    protected _isVisibleOnPlot(datum: any, pixelPoint: Point, selection: D3.Selection): boolean {
      var xRange = { min: 0, max: this.width() };
      var yRange = { min: 0, max: this.height() };
      var barBBox = selection[0][0].getBBox();

      return Plottable.Utils.Methods.intersectsBBox(xRange, yRange, barBBox);
    }

    /**
     * Gets the Entities at a particular Point.
     *
     * @param {Point} p
     * @returns {Entity[]}
     */
    public entitiesAt(p: Point): Entity[] {
      return this._entitiesIntersecting(p.x, p.y);
    }

    /**
     * Gets the Entities that intersect the Bounds.
     *
     * @param {Bounds} bounds
     * @returns {Entity[]}
     */
    public entitiesIn(bounds: Bounds): Entity[];
    /**
     * Gets the Entities that intersect the area defined by the ranges.
     *
     * @param {Range} xRange
     * @param {Range} yRange
     * @returns {Entity[]}
     */
    public entitiesIn(xRange: Range, yRange: Range): Entity[];
    public entitiesIn(xRangeOrBounds: Range | Bounds, yRange?: Range): Entity[] {
      var dataXRange: Range;
      var dataYRange: Range;
      if (yRange == null) {
        var bounds = (<Bounds> xRangeOrBounds);
        dataXRange = { min: bounds.topLeft.x, max: bounds.bottomRight.x };
        dataYRange = { min: bounds.topLeft.y, max: bounds.bottomRight.y };
      } else {
        dataXRange = (<Range> xRangeOrBounds);
        dataYRange = yRange;
      }
      return this._entitiesIntersecting(dataXRange, dataYRange);
    }

    private _entitiesIntersecting(xValOrRange: number | Range, yValOrRange: number | Range): Entity[] {
      var intersected: Entity[] = [];
      this.entities().forEach((entity) => {
        if (Utils.Methods.intersectsBBox(xValOrRange, yValOrRange, Utils.DOM.getBBox(entity.selection))) {
          intersected.push(entity);
        }
      });
      return intersected;
    }

    private _updateValueScale() {
      if (!this._projectorsReady()) {
        return;
      }
      var valueScale = this._isVertical ? this.y().scale : this.x().scale;
      if (valueScale instanceof QuantitativeScale) {
        var qscale = <QuantitativeScale<any>> valueScale;
        if (this._baselineValue != null) {
          qscale.addPaddingException(this, this._baselineValue);
          qscale.addIncludedValue(this, this._baselineValue);
        } else {
          qscale.removePaddingException(this);
          qscale.removeIncludedValue(this);
        }
      }
    }

    protected _additionalPaint(time: number) {
      var primaryScale: Scale<any, number> = this._isVertical ? this.y().scale : this.x().scale;
      var scaledBaseline = primaryScale.scale(this._baselineValue);

      var baselineAttr: any = {
        "x1": this._isVertical ? 0 : scaledBaseline,
        "y1": this._isVertical ? scaledBaseline : 0,
        "x2": this._isVertical ? this.width() : scaledBaseline,
        "y2": this._isVertical ? scaledBaseline : this.height()
      };

      this._getAnimator("baseline").animate(this._baseline, baselineAttr);

      this.datasets().forEach((dataset) => this._labelConfig.get(dataset).labelArea.selectAll("g").remove());
      if (this._labelsEnabled) {
        Utils.Methods.setTimeout(() => this._drawLabels(), time);
      }
    }

    private _drawLabels() {
      var dataToDraw = this._getDataToDraw();
      var labelsTooWide = false;
      this.datasets().forEach((dataset) => labelsTooWide = labelsTooWide || this._drawLabel(dataToDraw.get(dataset), dataset));
      if (this._hideBarsIfAnyAreTooWide && labelsTooWide) {
        this.datasets().forEach((dataset) => this._labelConfig.get(dataset).labelArea.selectAll("g").remove());
      }
    }

    private _drawLabel(data: any[], dataset: Dataset) {
      var attrToProjector = this._generateAttrToProjector();
      var labelConfig = this._labelConfig.get(dataset);
      var labelArea = labelConfig.labelArea;
      var measurer = labelConfig.measurer;
      var writer = labelConfig.writer;
      var labelTooWide: boolean[] = data.map((d, i) => {
        var primaryAccessor = this._isVertical ? this.y().accessor : this.x().accessor;
        var originalPositionFn = this._isVertical ? Plot._scaledAccessor(this.y()) : Plot._scaledAccessor(this.x());
        var primaryScale: Scale<any, number> = this._isVertical ? this.y().scale : this.x().scale;
        var scaledBaseline = primaryScale.scale(this._baselineValue);
        var text = this._labelFormatter(primaryAccessor(d, i, dataset)).toString();
        var w = attrToProjector["width"](d, i, dataset);
        var h = attrToProjector["height"](d, i, dataset);
        var x = attrToProjector["x"](d, i, dataset);
        var y = attrToProjector["y"](d, i, dataset);
        var positive = originalPositionFn(d, i, dataset) <= scaledBaseline;
        var measurement = measurer.measure(text);
        var color = attrToProjector["fill"](d, i, dataset);
        var dark = Utils.Colors.contrast("white", color) * 1.6 < Utils.Colors.contrast("black", color);
        var primary = this._isVertical ? h : w;
        var primarySpace = this._isVertical ? measurement.height : measurement.width;

        var secondaryAttrTextSpace = this._isVertical ? measurement.width : measurement.height;
        var secondaryAttrAvailableSpace = this._isVertical ? w : h;
        var tooWide = secondaryAttrTextSpace + 2 * Bar._LABEL_HORIZONTAL_PADDING > secondaryAttrAvailableSpace;
        if (measurement.height <= h && measurement.width <= w) {
          var offset = Math.min((primary - primarySpace) / 2, Bar._LABEL_VERTICAL_PADDING);
          if (!positive) { offset = offset * -1; }
          if (this._isVertical) {
            y += offset;
          } else {
            x += offset;
          }

          var g = labelArea.append("g").attr("transform", "translate(" + x + "," + y + ")");
          var className = dark ? "dark-label" : "light-label";
          g.classed(className, true);
          var xAlign: string;
          var yAlign: string;
          if (this._isVertical) {
            xAlign = "center";
            yAlign = positive ? "top" : "bottom";
          } else {
            xAlign = positive ? "left" : "right";
            yAlign = "center";
          }
          var writeOptions = {
              selection: g,
              xAlign: xAlign,
              yAlign: yAlign,
              textRotation: 0
          };
          writer.write(text, w, h, writeOptions);
        }
        return tooWide;
      });
      return labelTooWide.some((d: boolean) => d);
    }

    protected _generateDrawSteps(): Drawers.DrawStep[] {
      var drawSteps: Drawers.DrawStep[] = [];
      if (this._dataChanged && this._animate) {
        var resetAttrToProjector = this._generateAttrToProjector();
        var primaryScale: Scale<any, number> = this._isVertical ? this.y().scale : this.x().scale;
        var scaledBaseline = primaryScale.scale(this._baselineValue);
        var positionAttr = this._isVertical ? "y" : "x";
        var dimensionAttr = this._isVertical ? "height" : "width";
        resetAttrToProjector[positionAttr] = () => scaledBaseline;
        resetAttrToProjector[dimensionAttr] = () => 0;
        drawSteps.push({attrToProjector: resetAttrToProjector, animator: this._getAnimator(Plots.Animator.RESET)});
      }
      drawSteps.push({attrToProjector: this._generateAttrToProjector(), animator: this._getAnimator(Plots.Animator.MAIN)});
      return drawSteps;
    }

    protected _generateAttrToProjector() {
      // Primary scale/direction: the "length" of the bars
      // Secondary scale/direction: the "width" of the bars
      var attrToProjector = super._generateAttrToProjector();
      var primaryScale: Scale<any, number> = this._isVertical ? this.y().scale : this.x().scale;
      var primaryAttr = this._isVertical ? "y" : "x";
      var secondaryAttr = this._isVertical ? "x" : "y";
      var scaledBaseline = primaryScale.scale(this._baselineValue);

      var positionF = this._isVertical ? Plot._scaledAccessor(this.x()) : Plot._scaledAccessor(this.y());
      var widthF = attrToProjector["width"];
      var originalPositionFn = this._isVertical ? Plot._scaledAccessor(this.y()) : Plot._scaledAccessor(this.x());
      var heightF = (d: any, i: number, dataset: Dataset) => {
        return Math.abs(scaledBaseline - originalPositionFn(d, i, dataset));
      };

      attrToProjector["width"] = this._isVertical ? widthF : heightF;
      attrToProjector["height"] = this._isVertical ? heightF : widthF;

      attrToProjector[secondaryAttr] = (d: any, i: number, dataset: Dataset) =>
        positionF(d, i, dataset) - widthF(d, i, dataset) / 2;

      attrToProjector[primaryAttr] = (d: any, i: number, dataset: Dataset) => {
        var originalPos = originalPositionFn(d, i, dataset);
        // If it is past the baseline, it should start at the baselin then width/height
        // carries it over. If it's not past the baseline, leave it at original position and
        // then width/height carries it to baseline
        return (originalPos > scaledBaseline) ? scaledBaseline : originalPos;
      };

      return attrToProjector;
    }

    /**
     * Computes the barPixelWidth of all the bars in the plot.
     *
     * If the position scale of the plot is a CategoryScale and in bands mode, then the rangeBands function will be used.
     * If the position scale of the plot is a CategoryScale and in points mode, then
     *   from https://github.com/mbostock/d3/wiki/Ordinal-Scales#ordinal_rangePoints, the max barPixelWidth is step * padding
     * If the position scale of the plot is a QuantitativeScale, then _getMinimumDataWidth is scaled to compute the barPixelWidth
     */
    protected _getBarPixelWidth(): number {
      if (!this._projectorsReady()) { return 0; }
      var barPixelWidth: number;
      var barScale: Scale<any, number> = this._isVertical ? this.x().scale : this.y().scale;
      if (barScale instanceof Plottable.Scales.Category) {
        barPixelWidth = (<Plottable.Scales.Category> barScale).rangeBand();
      } else {
        var barAccessor = this._isVertical ? this.x().accessor : this.y().accessor;

        var numberBarAccessorData = d3.set(Utils.Methods.flatten(this.datasets().map((dataset) => {
          return dataset.data().map((d, i) => barAccessor(d, i, dataset))
                               .filter((d) => d != null)
                               .map((d) => d.valueOf());
        }))).values().map((value) => +value);

        numberBarAccessorData.sort((a, b) => a - b);

        var barAccessorDataPairs = d3.pairs(numberBarAccessorData);
        var barWidthDimension = this._isVertical ? this.width() : this.height();

        barPixelWidth = Utils.Methods.min(barAccessorDataPairs, (pair: any[], i: number) => {
          return Math.abs(barScale.scale(pair[1]) - barScale.scale(pair[0]));
        }, barWidthDimension * Bar._SINGLE_BAR_DIMENSION_RATIO);

        var scaledData = numberBarAccessorData.map((datum: number) => barScale.scale(datum));
        var minScaledDatum = Utils.Methods.min(scaledData, 0);
        if (minScaledDatum > 0) {
          barPixelWidth = Math.min(barPixelWidth, minScaledDatum * 2);
        }
        var maxScaledDatum = Utils.Methods.max(scaledData, 0);
        if ( maxScaledDatum < barWidthDimension) {
          var margin = barWidthDimension - maxScaledDatum;
          barPixelWidth = Math.min(barPixelWidth, margin * 2);
        }

        barPixelWidth *= Bar._BAR_WIDTH_RATIO;
      }
      return barPixelWidth;
    }

    public entities(datasets = this.datasets()): Plots.Entity[] {
      if (!this._projectorsReady()) {
        return [];
      }
      var entities = super.entities(datasets);
      var scaledBaseline = (<Scale<any, any>> (this._isVertical ? this.y().scale : this.x().scale)).scale(this.baselineValue());
      entities.forEach((entity) => {
        var bar = entity.selection;
        // Using floored pixel values to account for pixel accuracy inconsistencies across browsers
        if (this._isVertical && Math.floor(+bar.attr("y")) >= Math.floor(scaledBaseline)) {
          entity.position.y += +bar.attr("height");
        } else if (!this._isVertical && Math.floor(+bar.attr("x")) < Math.floor(scaledBaseline)) {
          entity.position.x -= +bar.attr("width");
        }

        if (this._isVertical) {
          entity.position.x = +bar.attr("x") + +bar.attr("width") / 2;
        } else {
          entity.position.y = +bar.attr("y") + +bar.attr("height") / 2;
        }
      });
      return entities;
    }

    protected _pixelPoint(datum: any, index: number, dataset: Dataset) {
      var attrToProjector = this._generateAttrToProjector();
      var rectX = attrToProjector["x"](datum, index, dataset);
      var rectY = attrToProjector["y"](datum, index, dataset);
      var rectWidth = attrToProjector["width"](datum, index, dataset);
      var rectHeight = attrToProjector["height"](datum, index, dataset);
      var x = this._isVertical ? rectX + rectWidth / 2 : rectX + rectWidth;
      var y = this._isVertical ? rectY : rectY + rectHeight / 2;
      return { x: x, y: y };
    }

    protected _getDataToDraw() {
      var dataToDraw = new Utils.Map<Dataset, any[]>();
      var attrToProjector = this._generateAttrToProjector();
      this.datasets().forEach((dataset: Dataset) => {
        var data = dataset.data().filter((d, i) => Utils.Methods.isValidNumber(attrToProjector["x"](d, i, dataset)) &&
                                                   Utils.Methods.isValidNumber(attrToProjector["y"](d, i, dataset)) &&
                                                   Utils.Methods.isValidNumber(attrToProjector["width"](d, i, dataset)) &&
                                                   Utils.Methods.isValidNumber(attrToProjector["height"](d, i, dataset)));
        dataToDraw.set(dataset, data);
      });
      return dataToDraw;
    }
  }
}
}
