import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "ttag";
import _ from "underscore";

import { ChartRenderingErrorBoundary } from "metabase/visualizations/components/ChartRenderingErrorBoundary";
import {
  getDefaultSize,
  getMinSize,
} from "metabase/visualizations/shared/utils/sizes";
import { CartesianChart } from "metabase/visualizations/visualizations/CartesianChart";
import {
  COMBO_CHARTS_SETTINGS_DEFINITIONS,
  getCartesianChartDefinition,
} from "metabase/visualizations/visualizations/CartesianChart/chart-definition";
import type Query from "metabase-lib/v1/queries/Query";
import type {
  Card,
  DatasetColumn,
  DatasetData,
  RawSeries,
  Series,
  TimelineEvent,
  TimelineEventId,
  TransformedSeries,
  VisualizationSettings,
} from "metabase-types/api";

import type {
  VisualizationProps,
  VisualizationSettingsDefinitions,
} from "../../types";
import {
  CartesianChartRenderer,
  CartesianChartRoot,
} from "../CartesianChart/CartesianChart.styled";
import { transformSeries } from "../CartesianChart/chart-definition-legacy";

function makeEChartsOption(series: RawSeries, settings: VisualizationSettings) {
  return {
    xAxis: {
      type: "category",
      data: ["A", "B", "C"],
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        data: [120, 200, 150],
        type: "line",
      },
    ],
  };
}

Object.assign(RadarChart, {
  uiName: t`Radar`,
  identifier: "radar",
  iconName: "line",
  noun: t`radar chart`,
  minSize: getMinSize("line"),
  defaultSize: getDefaultSize("line"),
  settings: {
    ...COMBO_CHARTS_SETTINGS_DEFINITIONS,
  } as any as VisualizationSettingsDefinitions,

  maxMetricsSupported: 2,
  maxDimensionsSupported: 2,

  noHeader: true,
  supportsSeries: true,
  canSavePng: true,

  // // disableClickBehavior?: boolean;
  // // hidden?: boolean;
  // // disableSettingsConfig?: boolean;
  // // supportPreviewing?: boolean;

  placeholderSeries: [
    {
      card: {
        display: "radar",
        visualization_settings: {
          "graph.metrics": ["x"],
          "graph.dimensions": ["y"],
        },
        dataset_query: { type: "query" },
        name: "x",
      },
      data: {
        rows: _.range(0, 11).map(i => [i, i]),
        cols: [
          { name: "x", base_type: "type/Integer" },
          { name: "y", base_type: "type/Integer" },
        ],
      },
    },
  ] as RawSeries,

  // transformSeries: (series: Series) => {
  //   console.log(series);

  //   return transformSeries(series);
  // },
  // TODO: remove dependency on metabase-lib
  isSensible: (data: DatasetData, query?: Query) => false,
  // checkRenderable throws an error if a visualization is not renderable
  checkRenderable: (
    series: Series,
    settings: VisualizationSettings,
    query: Query,
  ) => {},
  isLiveResizable: (series: Series) => true,
  // onDisplayUpdate?: (settings: VisualizationSettings) => VisualizationSettings;
});

export function RadarChart(props: VisualizationProps) {
  const { rawSeries, settings, isQueryBuilder, isEmbeddingSdk, onRenderError } =
    props;

  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  const handleResize = useCallback((width: number, height: number) => {
    setChartSize({ width, height });
  }, []);

  const option = useMemo(
    () => makeEChartsOption(rawSeries, settings),
    [rawSeries, settings],
  );

  return (
    <ChartRenderingErrorBoundary onRenderError={onRenderError}>
      <CartesianChartRoot
        isQueryBuilder={isQueryBuilder}
        isEmbeddingSdk={isEmbeddingSdk}
      >
        <CartesianChartRenderer
          option={option}
          onResize={handleResize}
          width={chartSize.width}
          height={chartSize.height}
        />
      </CartesianChartRoot>
    </ChartRenderingErrorBoundary>
  );
}
