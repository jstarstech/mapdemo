import React, {Component} from 'react';
import {Map} from 'mapbox-gl';
import DeckGL from '@deck.gl/react';
import {HexagonLayer} from '@deck.gl/aggregation-layers';
import {GridLayer} from '@deck.gl/aggregation-layers';
import Geohash from 'latlon-geohash';
import moment from 'moment';
import styles from './app.module.css';
import './app.css';

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN; // eslint-disable-line

const INITIAL_VIEW_STATE = {
    longitude: 35.0818,
    latitude: 31.4117,
    zoom: 9.6,
    maxZoom: 16,
    pitch: 0,
    bearing: 0
};

export default class App extends Component {
    constructor(props) {
        super(props);

        this.state = {
            layer: 'HexagonLayer', // HexagonLayer, GridLayer
            opacity: 0.2,
            colorAggregation: 'SUM', // 'SUM', 'MEAN', 'MIN', 'MAX'
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
            ts: '',
            cellSize: this._cellSizeForZoom(INITIAL_VIEW_STATE.zoom),
            radius: this._hexagonRadiusForZoom(INITIAL_VIEW_STATE.zoom),
            showOptionsPanel: false,
        };

        this.listenEvents();
    }

    listenEvents() {
        const evtSource = new EventSource("/sse", {withCredentials: false});

        evtSource.onmessage = event => {
            const data = JSON.parse(event.data);

            if (data.type === 'hub_count') {
                this.setState({
                    ts: moment(data.ts).format("YYYY-MM-DD HH:mm:ss"),
                    data: new Map([...new Map(this.state.data), ...new Map([[data.geoHash, data.hubCount]])]),
                });
            }

            if (data.type === "hub_count_bulk") {
                console.log(`received bulk update with ${data.items.length} items`)

                this.setState({
                    ts: moment(data.ts).format("YYYY-MM-DD HH:mm:ss"),
                    data: new Map([...new Map(this.state.data), ...new Map(data.items)]),
                });
            }
        }

        evtSource.addEventListener("ping", function (event) {
            const time = JSON.parse(event.data).time;
        });

        evtSource.onerror = function (err) {
            console.error("EventSource failed:", err);
        };
    }

    _cellSizeForZoom(zoom) {
        const minZoom = 1;
        const maxZoom = 16;

        const minCellSize = 100;
        const maxCellSize = 12000;

        const minSize = Math.log(maxCellSize);
        const maxSize = Math.log(minCellSize);

        const scale = (maxSize - minSize) / (maxZoom - minZoom);

        return Math.round(Math.exp(minSize + scale * (zoom - minZoom)));
    }

    _hexagonRadiusForZoom(zoom) {
        const minZoom = 1;
        const maxZoom = 16;

        const minRadius = 50;
        const maxRadius = 12000;

        const minSize = Math.log(maxRadius);
        const maxSize = Math.log(minRadius);

        const scale = (maxSize - minSize) / (maxZoom - minZoom);

        return Math.round(Math.exp(minSize + scale * (zoom - minZoom)));
    }

    _onViewStateChange(state) {
        // Adjust point size according to zoom level
        if (state.oldViewState.zoom !== state.viewState.zoom) {
            let newSize = -1;

            if (this.state.layer === 'HexagonLayer') {
                newSize = this._hexagonRadiusForZoom(state.viewState.zoom);

                if (this.state.radius !== newSize) {
                    this.setState({
                        radius: newSize
                    });
                }
            } else if (this.state.layer === 'GridLayer') {
                newSize = this._cellSizeForZoom(state.viewState.zoom);

                if (this.state.cellSize !== newSize) {
                    this.setState({
                        cellSize: newSize
                    });
                }
            }

            // console.log('Zoom changed:', state.viewState.zoom, 'newSize:', newSize, 'm');
        }
    }

    handleUserLayerChange(event) {
        this.setState({layer: event.target.value});
    }

    handleUserOpacityChange(event) {
        this.setState({opacity: event.target.value});
    }

    handleUserColorAggregationChange(event) {
        this.setState({colorAggregation: event.target.value});
    }

    toggleOptionsPanel(event) {
        this.setState({showOptionsPanel: !this.state.showOptionsPanel});
    }

    _renderLayers() {
        let layer = null;

        if (this.state.layer === 'HexagonLayer') {
            layer = new HexagonLayer({
                data: this.state.data,
                extruded: false,
                radius: this.state.radius,
                opacity: this.state.opacity,
                colorRange: this.state.colorRange,
                colorAggregation: this.state.colorAggregation,
                getPosition: d => {
                    const coords = Geohash.decode(d[0]);
                    return [coords.lon, coords.lat];
                },
                getColorWeight: d => {
                    return Number(d[1])
                },
            });
        } else if (this.state.layer === 'GridLayer') {
            layer = new GridLayer({
                data: this.state.data,
                extruded: false,
                cellSize: this.state.cellSize,
                opacity: this.state.opacity,
                colorRange: this.state.colorRange,
                colorAggregation: this.state.colorAggregation,
                getPosition: d => {
                    const coords = Geohash.decode(d[0]);
                    return [coords.lon, coords.lat];
                },
                getColorWeight: d => {
                    return Number(d[1])
                },
            });
        }

        return [layer];
    }

    render() {
        const {mapStyle = 'mapbox://styles/mapbox/dark-v9'} = this.props;

        return (
            <>
                {this.state.ts &&
                <div className={styles.timestamp}>{this.state.ts}</div>
                }

                <div className="menu-button top-right" onClick={this.toggleOptionsPanel.bind(this)}>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>

                {this.state.showOptionsPanel &&
                <div className="options-panel top-right">
                    <span className="close" onClick={this.toggleOptionsPanel.bind(this)}>&#x2716;</span>

                    <h3>Options <small>(will not be saved)</small></h3>
                    <hr/>

                    <div className="input">
                        <label>Layer</label>
                        <div className="tooltip">layer: {this.state.layer}</div>
                        <select value={this.state.layer}
                                onChange={this.handleUserLayerChange.bind(this)}>
                            <option value="HexagonLayer">HexagonLayer</option>
                            <option value="GridLayer">GridLayer</option>
                        </select>
                    </div>

                    <div className="input">
                        <label>Aggregation</label>
                        <div className="tooltip">colorAggregation: {this.state.colorAggregation}</div>
                        <select value={this.state.colorAggregation}
                                onChange={this.handleUserColorAggregationChange.bind(this)}>
                            <option value="SUM">SUM</option>
                            <option value="MIN">MIN</option>
                            <option value="MAX">MAX</option>
                            <option value="MEAN">MEAN</option>
                        </select>
                    </div>

                    <div className="input">
                        <label>Opacity</label>
                        <div className="tooltip">opacity: {this.state.opacity}</div>
                        <input name="cellSize"
                               min="0" max="1" type="range" step="0.01"
                               defaultValue={this.state.opacity}
                               onChange={this.handleUserOpacityChange.bind(this)}
                        />
                    </div>
                    <br/>
                </div>
                }

                <DeckGL
                    layers={this._renderLayers()}
                    initialViewState={INITIAL_VIEW_STATE}
                    onViewStateChange={this._onViewStateChange.bind(this)}
                    controller={true}
                >
                    <Map
                        reuseMaps
                        mapStyle={mapStyle}
                        styleDiffing={true}
                        mapboxAccessToken={MAPBOX_TOKEN}
                    />
                </DeckGL>
            </>
        );
    }
}

import { createRoot } from 'react-dom/client';
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App/>);
