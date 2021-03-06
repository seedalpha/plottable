function makeData() {
  "use strict";

  var data = makeRandomData(100, 1e15);
  // data.push({x: 0, y: 0});
  return data;
}

function run(div, data, Plottable) {
  "use strict";

  // doesn't exist on master yet
  if (Plottable.Scale.ModifiedLog == null) {
    return;
  }

  var svg = div.append("svg").attr("height", 500);
  var doAnimate = true;
  var circleRenderer;
  var xScale = new Plottable.Scale.Linear();
  var xAxis = new Plottable.Axis.Numeric(xScale, "bottom");

  var yScale = new Plottable.Scale.ModifiedLog();
  var yAxis = new Plottable.Axis.Numeric(yScale, "left", new Plottable.Formatter.SISuffix());
  yAxis.showEndTickLabel("top", false);
  yAxis.showEndTickLabel("bottom", false);

  circleRenderer = new Plottable.Plot.Scatter(xScale, yScale).addDataset(data);
  circleRenderer.attr("r", 8);
  circleRenderer.attr("opacity", 0.75);
  circleRenderer.animate(doAnimate);

  var gridlines = new Plottable.Component.Gridlines(xScale, yScale);

  var circleChart = new Plottable.Component.Table([[yAxis, circleRenderer.merge(gridlines)],
   [null,  xAxis]]);
  circleChart.renderTo(svg);

  var cb = function(x, y){
    d = circleRenderer.dataset().data();
    circleRenderer.dataset().data(d);
  };

  circleRenderer.registerInteraction(
    new Plottable.Interaction.Click().callback(cb)
  );
}
