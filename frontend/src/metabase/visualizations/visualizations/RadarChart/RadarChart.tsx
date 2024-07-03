import type { EChartsOption, LineSeriesOption } from "echarts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "ttag";
import _ from "underscore";

import { ChartRenderingErrorBoundary } from "metabase/visualizations/components/ChartRenderingErrorBoundary";
import {
  getDefaultSize,
  getMinSize,
} from "metabase/visualizations/shared/utils/sizes";
import type Query from "metabase-lib/v1/queries/Query";
import type {
  DatasetData,
  RawSeries,
  Series,
  VisualizationSettings,
} from "metabase-types/api";

import type {
  Visualization,
  VisualizationProps,
  VisualizationSettingsDefinitions,
} from "../../types";
import {
  CartesianChartRenderer,
  CartesianChartRoot,
} from "../CartesianChart/CartesianChart.styled";
import "echarts/lib/component/legend";

function rotate2DVector(len: number, angle: number): Array<number> {
  return [len * Math.cos(angle), len * Math.sin(angle)];
}

function makeEChartsOption(
  series: RawSeries,
  settings: VisualizationSettings,
): EChartsOption {
  if (series.length < 1) {
    return {};
  }
  const { data } = series[0];
  const { cols, rows } = data;
  const numColsIds: Array<number> = [];
  const labelColsIds: Array<number> = [];
  cols.forEach((col, idx) => {
    switch (col.base_type) {
      case "type/Integer":
      case "type/Float":
        numColsIds.push(idx);
        break;
      case "type/Text":
        labelColsIds.push(idx);
        break;
    }
  });
  if (numColsIds.length < 1) {
    return {};
  }

  let labelColId = 0;
  cols.forEach((col, idx) => {
    if (col.name === settings["radar.title_column"]) {
      labelColId = idx;
    }
  });
  const nRadii = numColsIds.length;
  const radiiAngle = (2 * Math.PI) / nRadii;
  const radii = [];
  const varSeries = rows.map(
    row =>
      ({
        name: row[labelColId],
        data: [],
        type: "line",
        colorBy: "series",
        emphasis: {
          focus: "series",
          // label: {
          //   show: true,
          //   formatter: "{a}",
          //   position: "top",
          // },
        },
      } as LineSeriesOption),
  );

  for (let i = 0; i < numColsIds.length; i++) {
    const angle = i * radiiAngle;
    const colId = numColsIds[i];
    radii.push([0, 0], {
      name: cols[colId].name,
      value: rotate2DVector(1, angle),
    });
    const column = rows.map(row => row[colId] as number);
    const maxVal = Math.max(...column);
    const minVal = Math.min(...column);
    const scale = maxVal - minVal;
    column.forEach((val, rowIdx) => {
      const normValue = (val - minVal) / scale;
      varSeries[rowIdx].data?.push({
        name: val.toString(),
        value: rotate2DVector(normValue, angle),
        emphasis: {
          label: {
            show: true,
            formatter: "{b}",
          },
        },
      });
    });
  }
  varSeries.forEach(vs => {
    vs.data?.push(vs.data[0]);
  });

  settings["graph.y_axis.scale"];
  return {
    xAxis: {
      show: false,
    },
    yAxis: {
      show: false,
    },
    series: [
      {
        // name: "radii",
        data: radii,
        type: "line",
        color: "grey",
        emphasis: {
          label: {
            show: true,
          },
        },
        label: {
          show: true,
          position: "bottom",
          formatter: "{b}",
        },
      },
      ...varSeries,
    ],
    legend: settings["radar.show_legend"]
      ? {
          orient: "vertical",
          top: "center",
          left: 10,
          // data: varSeries.map(s => s.name),
        }
      : undefined,
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
    "radar.title_column": {
      section: t`Display`,
      title: t`Column with title`,
      widget: "select",
      getProps: series => ({
        options: series[0]?.data.cols.map(col => ({
          name: col.name,
          value: col.name,
        })),
      }),
      getDefault: series => {
        const labelCol = series[0]?.data.cols.find(
          col => col.base_type === "type/Text",
        );
        return labelCol?.name;
      },
    },
    "radar.show_legend": {
      title: t`Show legend`,
      section: t`Display`,
      widget: "toggle",
      default: false,
    },
  } as VisualizationSettingsDefinitions,

  // maxMetricsSupported: 30,
  // maxDimensionsSupported: 2,

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

  isSensible: (_data: DatasetData, _query?: Query) => false,
  // checkRenderable throws an error if a visualization is not renderable
  checkRenderable: (
    series: Series,
    _settings: VisualizationSettings,
    _query: Query,
  ) => {
    series.forEach(s => {
      if (s.data.rows.length > 30) {
        throw new Error("Too many rows to visualise");
      }
    });
  },
  isLiveResizable: (_series: Series) => true,
  // onDisplayUpdate?: (settings: VisualizationSettings) => VisualizationSettings;
} as Visualization);

export function RadarChart(props: VisualizationProps) {
  const { rawSeries, settings, isQueryBuilder, isEmbeddingSdk, onRenderError } =
    props;

  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  const handleResize = useCallback((width: number, height: number) => {
    setChartSize({ width, height });
  }, []);

  const option = useMemo<EChartsOption>(
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
