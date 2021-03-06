///<reference path="../reference.ts" />

module Plottable {
  export class QuantitativeScale<D> extends Scale<D, number> {
    protected static _DEFAULT_NUM_TICKS = 10;
    private _tickGenerator: Scales.TickGenerators.TickGenerator<D> = (scale: Plottable.QuantitativeScale<D>) => scale.getDefaultTicks();
    private _padProportion = 0.05;
    private _paddingExceptions: Utils.Map<any, D>;
    private _includedValues: Utils.Map<any, D>;
    private _domainMin: D;
    private _domainMax: D;

    /**
     * A QuantitativeScale is a Scale that maps number-like values to numbers.
     * It is invertible and continuous.
     *
     * @constructor
     */
    constructor() {
      super();
      this._paddingExceptions = new Utils.Map<any, D>();
      this._includedValues = new Utils.Map<any, D>();
    }

    public autoDomain() {
      this._domainMin = null;
      this._domainMax = null;
      super.autoDomain();
      return this;
    }

    protected _autoDomainIfAutomaticMode() {
      if (this._domainMin != null && this._domainMax != null) {
        this._setDomain([this._domainMin, this._domainMax]);
        return;
      }

      var computedExtent = this._getExtent();

      if (this._domainMin != null) {
        var maxValue = computedExtent[1];
        if (this._domainMin >= maxValue) {
          maxValue = this._expandSingleValueDomain([this._domainMin, this._domainMin])[1];
        }
        this._setDomain([this._domainMin, maxValue]);
        return;
      }

      if (this._domainMax != null) {
        var minValue = computedExtent[0];
        if (this._domainMax <= minValue) {
          minValue = this._expandSingleValueDomain([this._domainMax, this._domainMax])[0];
        }
        this._setDomain([minValue, this._domainMax]);
        return;
      }

      super._autoDomainIfAutomaticMode();
    }

    protected _getExtent(): D[] {
      var extents = this._getAllExtents().filter((extent) => extent.length > 0);
      var extent: D[];
      var defaultExtent = this._defaultExtent();
      if (extents.length === 0) {
        extent = defaultExtent;
      } else {
        var combinedExtent = [
          Utils.Methods.min<D[], D>(extents, (extent) => extent[0], defaultExtent[0]),
          Utils.Methods.max<D[], D>(extents, (extent) => extent[1], defaultExtent[1])
        ];
        var includedDomain = this._includeValues(combinedExtent);
        extent = this._padDomain(includedDomain);
      }

      if (this._domainMin != null) {
        extent[0] = this._domainMin;
      }
      if (this._domainMax != null) {
        extent[1] = this._domainMax;
      }
      return extent;
    }

    /**
     * Adds a padding exception.
     * If one end of the domain is set to an excepted value as a result of autoDomain()-ing,
     * that end of the domain will not be padded.
     * 
     * @param {any} key A key that identifies the padding exception.
     * @param {D} exception
     * @returns {QuantitativeScale} The calling QuantitativeScale. 
     */
    public addPaddingException(key: any, exception: D) {
      this._paddingExceptions.set(key, exception);
      this._autoDomainIfAutomaticMode();
      return this;
    }

    /**
     * Removes the padding exception associated with the specified key.
     * 
     * @param {any} key
     * @returns {QuantitativeScale} The calling QuantitativeScale. 
     */
    public removePaddingException(key: any) {
      this._paddingExceptions.delete(key);
      this._autoDomainIfAutomaticMode();
      return this;
    }

    /**
     * Adds an included value.
     * The supplied value will always be included in the domain when autoDomain()-ing.
     * 
     * @param {any} key A key that identifies the included value.
     * @param {D} value
     * @returns {QuantitativeScale} The calling QuantitativeScale. 
     */
    public addIncludedValue(key: any, value: D) {
      this._includedValues.set(key, value);
      this._autoDomainIfAutomaticMode();
      return this;
    }

    /**
     * Removes the included value associated with the specified key.
     * 
     * @param {any} key
     * @returns {QuantitativeScale} The calling QuantitativeScale. 
     */
    public removeIncludedValue(key: any) {
      this._includedValues.delete(key);
      this._autoDomainIfAutomaticMode();
      return this;
    }

    /**
     * Gets the padding proportion.
     */
    public padProportion(): number;
    /**
     * Sets the padding porportion.
     * When autoDomain()-ing, the computed domain will be expanded by this proportion,
     * then rounded to human-readable values.
     * 
     * @param {number} padProportion The padding proportion. Passing 0 disables padding.
     * @returns {QuantitativeScale} The calling QuantitativeScale. 
     */
    public padProportion(padProportion: number): QuantitativeScale<D>;
    public padProportion(padProportion?: number): any {
      if (padProportion == null) {
        return this._padProportion;
      }
      if (padProportion < 0) {
        throw new Error("padProportion must be non-negative");
      }
      this._padProportion = padProportion;
      this._autoDomainIfAutomaticMode();
      return this;
    }

    private _includeValues(domain: D[]) {
      this._includedValues.forEach((value) => {
        if (value < domain[0]) {
          domain[0] = value;
        }
        if (value > domain[1]) {
          domain[1] = value;
        }
      });
      return domain;
    }

    private _padDomain(domain: D[]) {
      if (domain[0].valueOf() === domain[1].valueOf()) {
        return this._expandSingleValueDomain(domain);
      }
      if (this._padProportion === 0) {
        return domain;
      }
      var p = this._padProportion / 2;
      var min = domain[0];
      var max = domain[1];
      var minExistsInExceptions = false;
      var maxExistsInExceptions = false;
      this._paddingExceptions.forEach((value: D) => {
        if (value === min) {
          minExistsInExceptions = true;
        }
        if (value === max) {
          maxExistsInExceptions = true;
        }
      });
      var newMin = minExistsInExceptions ? min : this.invert(this.scale(min) - (this.scale(max) - this.scale(min)) * p);
      var newMax = maxExistsInExceptions ? max : this.invert(this.scale(max) + (this.scale(max) - this.scale(min)) * p);
      return this._niceDomain([newMin, newMax]);
    }

    protected _expandSingleValueDomain(singleValueDomain: D[]): D[] {
      return singleValueDomain;
    }

    /**
     * Computes the domain value corresponding to a supplied range value.
     *
     * @param {number} value: A value from the Scale's range.
     * @returns {D} The domain value corresponding to the supplied range value.
     */

    public invert(value: number): D {
      throw new Error("Subclasses should override _invert");
    }

    public domain(): D[];
    public domain(values: D[]): QuantitativeScale<D>;
    public domain(values?: D[]): any {
      if (values != null) {
        this._domainMin = values[0];
        this._domainMax = values[1];
      }
      return super.domain(values);
    }

    /**
     * Gets the lower end of the domain.
     *
     * @return {D}
     */
    public domainMin(): D;
    /**
     * Sets the lower end of the domain.
     *
     * @return {QuantitativeScale} The calling QuantitativeScale.
     */
    public domainMin(domainMin: D): QuantitativeScale<D>;
    public domainMin(domainMin?: D): any {
      if (domainMin == null) {
        return this.domain()[0];
      }
      this._domainMin = domainMin;
      this._autoDomainIfAutomaticMode();
      return this;
    }

    /**
     * Gets the upper end of the domain.
     *
     * @return {D}
     */
    public domainMax(): D;
    /**
     * Sets the upper end of the domain.
     *
     * @return {QuantitativeScale} The calling QuantitativeScale.
     */
    public domainMax(domainMax: D): QuantitativeScale<D>;
    public domainMax(domainMax?: D): any {
      if (domainMax == null) {
        return this.domain()[1];
      }
      this._domainMax = domainMax;
      this._autoDomainIfAutomaticMode();
      return this;
    }

    public extentOfValues(values: D[]) {
      var extent = d3.extent(values);
      if (extent[0] == null || extent[1] == null) {
        return [];
      } else {
        return extent;
      }
    }

    protected _setDomain(values: D[]) {
      var isNaNOrInfinity = (x: any) => x !== x || x === Infinity || x === -Infinity;
      if (isNaNOrInfinity(values[0]) || isNaNOrInfinity(values[1])) {
        Utils.Methods.warn("Warning: QuantitativeScales cannot take NaN or Infinity as a domain value. Ignoring.");
        return;
      }
      super._setDomain(values);
    }

    /**
     * Gets the array of tick values generated by the default algorithm.
     */
    public getDefaultTicks(): D[] {
      throw new Error("Subclasses should override _getDefaultTicks");
    }

    /**
     * Gets an array of tick values spanning the domain.
     *
     * @returns {D[]}
     */
    public ticks(): D[] {
      return this._tickGenerator(this);
    }

    /**
     * Given a domain, expands its domain onto "nice" values, e.g. whole
     * numbers.
     */
    protected _niceDomain(domain: D[], count?: number): D[] {
      throw new Error("Subclasses should override _niceDomain");
    }

    protected _defaultExtent(): D[] {
      throw new Error("Subclasses should override _defaultExtent");
    }

    /**
     * Gets the TickGenerator.
     */
    public tickGenerator(): Scales.TickGenerators.TickGenerator<D>;
    /**
     * Sets the TickGenerator
     *
     * @param {TickGenerator} generator
     * @return {QuantitativeScale} The calling QuantitativeScale.
     */
    public tickGenerator(generator: Scales.TickGenerators.TickGenerator<D>): QuantitativeScale<D>;
    public tickGenerator(generator?: Scales.TickGenerators.TickGenerator<D>): any {
      if (generator == null) {
        return this._tickGenerator;
      } else {
        this._tickGenerator = generator;
        return this;
      }
    }
  }
}
