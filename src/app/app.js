import { GridLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import DeckGL from "@deck.gl/react";
import Geohash from "latlon-geohash";
import React, { useState, useEffect } from "react";
import { Map as MapBoxMap } from "react-map-gl";
import moment from "moment";
import "./app.css";
import styles from "./app.module.css";

const INITIAL_VIEW_STATE = {
  longitude: 35.0818,
  latitude: 31.4117,
  zoom: 9.6,
  maxZoom: 16,
  pitch: 0,
  bearing: 0,
};

function _cellSizeForZoom(zoom) {
  const minZoom = 1;
  const maxZoom = 16;

  const minCellSize = 100;
  const maxCellSize = 12000;

  const minSize = Math.log(maxCellSize);
  const maxSize = Math.log(minCellSize);

  const scale = (maxSize - minSize) / (maxZoom - minZoom);

  return Math.round(Math.exp(minSize + scale * (zoom - minZoom)));
}

function _hexagonRadiusForZoom(zoom) {
  const minZoom = 1;
  const maxZoom = 16;

  const minRadius = 50;
  const maxRadius = 12000;

  const minSize = Math.log(maxRadius);
  const maxSize = Math.log(minRadius);

  const scale = (maxSize - minSize) / (maxZoom - minZoom);

  return Math.round(Math.exp(minSize + scale * (zoom - minZoom)));
}
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN; // eslint-disable-line

function App() {
  const [state, setState] = useState({
    layer: "HexagonLayer", // HexagonLayer, GridLayer
    opacity: 0.2,
    colorAggregation: "SUM", // 'SUM', 'MEAN', 'MIN', 'MAX'
    colorRange: [
      [255, 255, 178, 255],
      [254, 217, 118, 255],
      [254, 178, 76, 255],
      [253, 141, 60, 255],
      [240, 59, 32, 255],
      [189, 0, 38, 255],
    ], // 6 colors, each can be [R, G, B] or [R, G, B, A]
    // https://colorbrewer2.org/#type=sequential&scheme=YlOrRd&n=6
    data: new Map(),
    ts: "",
    cellSize: _cellSizeForZoom(INITIAL_VIEW_STATE.zoom),
    radius: _hexagonRadiusForZoom(INITIAL_VIEW_STATE.zoom),
    showOptionsPanel: false,
  });

  useEffect(() => {
    const evtSource = new EventSource("/sse", { withCredentials: false });

    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "hub_count") {
        setState({
          ...state,
          ts: moment(data.ts).format("YYYY-MM-DD HH:mm:ss"),
          data: new Map([
            ...new Map(state.data),
            ...new Map([[data.geoHash, data.hubCount]]),
          ]),
        });
      }

      if (data.type === "hub_count_bulk") {
        console.log(`received bulk update with ${data.items.length} items`);

        setState({
          ...state,
          ts: moment(data.ts).format("YYYY-MM-DD HH:mm:ss"),
          data: new Map([...new Map(state.data), ...new Map(data.items)]),
        });
      }
    };

    evtSource.addEventListener("ping", function (event) {
      const time = JSON.parse(event.data).time;
    });

    evtSource.onerror = function (err) {
      console.error("EventSource failed:", err);
    };

    return () => {
      evtSource.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUserLayerChange = (event) => {
    setState({
      ...state,
      layer: event.target.value,
    });
  };

  const handleUserOpacityChange = (event) => {
    setState({
      ...state,
      opacity: event.target.value,
    });
  };

  const handleUserColorAggregationChange = (event) => {
    setState({
      ...state,
      colorAggregation: event.target.value,
    });
  };

  const toggleOptionsPanel = () => {
    setState({
      ...state,
      showOptionsPanel: !state.showOptionsPanel,
    });
  };

  const _onViewStateChange = (state) => {
    // Adjust point size according to zoom level
    if (state.oldViewState.zoom !== state.viewState.zoom) {
      let newSize = -1;

      if (state.layer === "HexagonLayer") {
        newSize = _hexagonRadiusForZoom(state.viewState.zoom);

        if (state.radius !== newSize) {
          setState({
            ...state,
            radius: newSize,
          });
        }
      } else if (state.layer === "GridLayer") {
        newSize = _cellSizeForZoom(state.viewState.zoom);

        if (state.cellSize !== newSize) {
          setState({
            ...state,
            cellSize: newSize,
          });
        }
      }

      // console.log('Zoom changed:', state.viewState.zoom, 'newSize:', newSize, 'm');
    }
  };

  let layer = null;

  if (state.layer === "HexagonLayer") {
    layer = new HexagonLayer({
      data: state.data,
      extruded: false,
      radius: state.radius,
      opacity: state.opacity,
      colorRange: state.colorRange,
      colorAggregation: state.colorAggregation,
      getPosition: (d) => {
        const coords = Geohash.decode(d[0]);
        return [coords.lon, coords.lat];
      },
      getColorWeight: (d) => {
        return Number(d[1]);
      },
    });
  } else if (state.layer === "GridLayer") {
    layer = new GridLayer({
      data: state.data,
      extruded: false,
      cellSize: state.cellSize,
      opacity: state.opacity,
      colorRange: state.colorRange,
      colorAggregation: state.colorAggregation,
      getPosition: (d) => {
        const coords = Geohash.decode(d[0]);
        return [coords.lon, coords.lat];
      },
      getColorWeight: (d) => {
        return Number(d[1]);
      },
    });
  }

  const layers = [layer];

  return (
    <>
      {state.ts && <div className={styles.timestamp}>{state.ts}</div>}

      <div className="menu-button top-right" onClick={toggleOptionsPanel}>
        <div></div>
        <div></div>
        <div></div>
      </div>

      {state.showOptionsPanel && (
        <div className="options-panel top-right">
          <span className="close" onClick={toggleOptionsPanel}>
            &#x2716;
          </span>

          <h3>
            Options <small>(will not be saved)</small>
          </h3>
          <hr />

          <div className="input">
            <label>Layer</label>
            <div className="tooltip">layer: {state.layer}</div>
            <select value={state.layer} onChange={handleUserLayerChange}>
              <option value="HexagonLayer">HexagonLayer</option>
              <option value="GridLayer">GridLayer</option>
            </select>
          </div>

          <div className="input">
            <label>Aggregation</label>
            <div className="tooltip">
              colorAggregation: {state.colorAggregation}
            </div>
            <select
              value={state.colorAggregation}
              onChange={handleUserColorAggregationChange}
            >
              <option value="SUM">SUM</option>
              <option value="MIN">MIN</option>
              <option value="MAX">MAX</option>
              <option value="MEAN">MEAN</option>
            </select>
          </div>

          <div className="input">
            <label>Opacity</label>
            <div className="tooltip">opacity: {state.opacity}</div>
            <input
              name="cellSize"
              min="0"
              max="1"
              type="range"
              step="0.01"
              defaultValue={state.opacity}
              onChange={handleUserOpacityChange}
            />
          </div>
          <br />
        </div>
      )}
      <DeckGL
        layers={layers}
        initialViewState={INITIAL_VIEW_STATE}
        onViewStateChange={_onViewStateChange}
        controller={true}
      >
        <MapBoxMap
          reuseMaps
          mapStyle="mapbox://styles/mapbox/dark-v9"
          styleDiffing={true}
          mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        />
      </DeckGL>
    </>
  );
}

import { createRoot } from "react-dom/client";
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
