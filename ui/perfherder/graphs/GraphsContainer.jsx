/* eslint-disable react/no-did-update-set-state */
/* eslint-disable jsx-a11y/no-static-element-interactions */

// disabling due to a new bug with this rule: https://github.com/eslint/eslint/issues/12117
/* eslint-disable no-unused-vars */
import React from 'react';
import { Row, Col } from 'reactstrap';
import PropTypes from 'prop-types';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryBrushContainer,
  VictoryScatter,
  createContainer,
  VictoryTooltip,
} from 'victory';
import moment from 'moment';
import debounce from 'lodash/debounce';
import last from 'lodash/last';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

import { formatNumber } from '../helpers';

import GraphTooltip from './GraphTooltip';

const VictoryZoomSelectionContainer = createContainer('zoom', 'selection');

const CustomSVGTooltip = props => {
  const { width, centered, title, aumValue } = props;

  return (
    <foreignObject width="100%" height="100%">
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          width: `100%`,
          maxWidth: `${width}px`,
          height: `auto`,
          padding: `16px 18px`,
          background: '#fff',
          color: '#000',
          border: `1px solid #fff`,
          borderRadius: '3px',
          fontSize: '14px',
          top: '100px',
          left: '100px',
          transform: `translateX(${centered.x}px) translateY(${centered.y}px)`,
        }}
      >
        <header style={{ margin: '0 0 12px' }}>{title}</header>
        <p style={{ fontSize: '10px' }}>
          <strong>Balance: </strong>
          {aumValue}
        </p>
        <div className="tip" />
      </div>
    </foreignObject>
  );
};

// the tooltip box should be these dimensions
const chartTooltipDimensions = {
  width: 160,
  height: 65,
};

// the custom point tooltip
class ChartPointTooltip extends React.Component {
  render() {
    const { x, y, pointSize } = this.props;
    const { width } = chartTooltipDimensions;
    const { height } = chartTooltipDimensions;
    const verticalOffset = 20;
    const centered = {
      x: x - width / 2,
      y: y - (height + verticalOffset),
    };

    return (
      <CustomSVGTooltip
        width={width}
        height={height}
        centered={centered}
        {...this.props.datum}
      />
    );
  }
}

class GraphsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.updateZoom = debounce(this.updateZoom.bind(this), 500);
    this.tooltip = React.createRef();
    this.leftChartPadding = 25;
    this.rightChartPadding = 10;
    this.state = {
      highlights: [],
      scatterPlotData: this.props.testData.flatMap(item =>
        item.visible ? item.data : [],
      ),
      showTooltip: false,
      lockTooltip: false,
      dataPoint: this.props.selectedDataPoint,
      externalMutation: undefined,
    };
  }

  componentDidMount() {
    const { zoom, selectedDataPoint } = this.props;

    this.addHighlights();
    if (selectedDataPoint) this.verifySelectedDataPoint();
  }

  componentDidUpdate(prevProps) {
    const {
      highlightAlerts,
      highlightedRevisions,
      testData,
      timeRange,
    } = this.props;

    if (
      prevProps.highlightAlerts !== highlightAlerts ||
      prevProps.highlightedRevisions !== highlightedRevisions
    ) {
      this.addHighlights();
    }

    if (prevProps.testData !== testData) {
      this.updateGraphs();
    }

    if (prevProps.timeRange !== timeRange && this.state.dataPoint) {
      this.setState({
        dataPoint: null,
        showTooltip: false,
        lockTooltip: false,
      });
    }
  }

  verifySelectedDataPoint = () => {
    const { selectedDataPoint, testData, updateStateParams } = this.props;

    const dataPointFound = testData.find(item => {
      if (item.signature_id === selectedDataPoint.signature_id) {
        return item.data.find(datum =>
          selectedDataPoint.dataPointId
            ? datum.dataPointId === selectedDataPoint.dataPointId
            : datum.pushId === selectedDataPoint.pushId,
        );
      }
      return false;
    });

    if (dataPointFound) {
      this.setState({ dataPoint: selectedDataPoint });
      // this.showTooltip(selectedDataPoint, true);
    } else {
      updateStateParams({
        errorMessages: [
          `Tooltip for datapoint with signature ${
            selectedDataPoint.signature_id
          } and date ${moment
            .utc(selectedDataPoint.x)
            .format('MMM DD hh:mm')} UTC can't be found.`,
        ],
      });
    }
  };

  updateGraphs = () => {
    const { testData, updateStateParams, visibilityChanged } = this.props;
    const scatterPlotData = testData.flatMap(item =>
      item.visible ? item.data : [],
    );
    this.addHighlights();
    this.setState({
      scatterPlotData,
    });

    if (!visibilityChanged) {
      updateStateParams({ zoom: {} });
    }
  };

  addHighlights = () => {
    const { testData, highlightAlerts, highlightedRevisions } = this.props;
    let highlights = [];

    for (const series of testData) {
      if (!series.visible) {
        continue;
      }

      if (highlightAlerts) {
        const dataPoints = series.data.filter(item => item.alertSummary);
        highlights = [...highlights, ...dataPoints];
      }

      for (const rev of highlightedRevisions) {
        if (!rev) {
          continue;
        }
        // in case people are still using 12 character sha
        const dataPoint = series.data.find(
          item => item.revision.indexOf(rev) !== -1,
        );

        if (dataPoint) {
          highlights.push(dataPoint);
        }
      }
    }
    this.setState({ highlights });
  };

  getTooltipPosition = (point, yOffset = 15) => ({
    left: point.x - 280 / 2,
    top: point.y - yOffset,
  });

  setTooltip = (dataPoint, lock = false) => {
    const { lockTooltip } = this.state;
    const { updateStateParams } = this.props;

    // we don't want the mouseOver event to reposition the tooltip
    // if (lockTooltip && !lock) {
    //   return;
    // }

    if (lock) {
      updateStateParams({
        selectedDataPoint: {
          signature_id: dataPoint.datum.signature_id,
          pushId: dataPoint.datum.pushId,
          x: dataPoint.x,
          y: dataPoint.y,
          dataPointId: dataPoint.datum.dataPointId,
        },
      });
    }
    this.setState({
      // showTooltip: true,
      lockTooltip: lock,
      dataPoint,
    });
    return { active: true };
  };

  closeTooltip = () => {
    this.setState({
      showTooltip: false,
      lockTooltip: false,
      dataPoint: null,
    });
    this.props.updateStateParams({ selectedDataPoint: null });
  };

  // The Victory library doesn't provide a way of dynamically setting the left
  // padding for the y axis tick labels, so this is a workaround (setting state
  // doesn't work with this callback, which is why a class property is used instead)
  setLeftPadding = (tick, index, ticks) => {
    const highestTickLength = ticks[ticks.length - 1].toString();
    const newLeftPadding = highestTickLength.length * 8 + 16;
    this.leftChartPadding =
      this.leftChartPadding > newLeftPadding
        ? this.leftChartPadding
        : newLeftPadding;

    return formatNumber(tick);
  };

  setRightPadding = (tick, index, ticks) => {
    const highestTickLength = ticks[ticks.length - 1].toString();
    const newRightPadding = highestTickLength.length / 2;
    this.rightChartPadding =
      this.rightChartPadding > newRightPadding
        ? this.rightChartPadding
        : newRightPadding;
    return this.checkDate(tick);
  };

  checkDate = x => {
    const graphData = this.props.testData.filter(
      item => item.visible === true && item.data.length > 0,
    );

    return graphData.length > 0
      ? moment.utc(x).format('MMM DD')
      : moment.utc().format('MMM DD');
  };

  hideTooltip = props => {
    const { showTooltip, lockTooltip, dataPoint } = this.state;

    if (
      lockTooltip &&
      dataPoint.datum.dataPointId === props.datum.dataPointId
    ) {
      return { active: true };
    }
    return { active: undefined };
  };

  // debounced
  updateZoom(zoom) {
    const { showTooltip, lockTooltip } = this.state;

    if (showTooltip && lockTooltip) {
      this.closeTooltip();
    }
    this.props.updateStateParams({ zoom });
  }

  removeMutation = () => {
    this.setState({
      externalMutation: undefined,
    });
  };

  closeTooltip = () => {
    this.setState({
      externalMutation: [
        {
          childName: 'scatter-plot',
          target: 'labels',
          eventKey: 'all',
          mutation: props => {
            if (props.active === true) {
              console.log(props);
            }
            return props;
          },
          callback: this.removeMutation,
        },
      ],
    });
  };

  render() {
    const { testData, zoom, highlightedRevisions } = this.props;
    const {
      highlights,
      scatterPlotData,
      showTooltip,
      lockTooltip,
      dataPoint,
      externalMutation,
    } = this.state;

    const highlightPoints = !!highlights.length;

    const hasHighlightedRevision = point =>
      highlightedRevisions.find(rev => point.revision.indexOf(rev) !== -1);

    const axisStyle = {
      grid: { stroke: 'lightgray', strokeWidth: 0.5 },
      tickLabels: { fontSize: 13 },
    };

    const chartPadding = {
      top: 10,
      left: this.leftChartPadding,
      right: this.rightChartPadding,
      bottom: 50,
    };

    return (
      <React.Fragment>
        <div
        // data-testid="graph-tooltip"
        // className={`graph-tooltip ${showTooltip ? 'show' : 'hide'} ${
        //   lockTooltip ? 'locked' : ''
        // }`}
        // ref={this.tooltip}
        >
          <span className="close mr-3 my-2 ml-2" onClick={this.closeTooltip}>
            <FontAwesomeIcon
              className="pointer text-white"
              icon={faTimes}
              size="xs"
              title="close tooltip"
            />
          </span>
        </div>
        <Row>
          <Col className="p-0 col-md-auto">
            <VictoryChart
              padding={chartPadding}
              width={1350}
              height={150}
              style={{ parent: { maxHeight: '150px', maxWidth: '1350px' } }}
              scale={{ x: 'time', y: 'linear' }}
              domainPadding={{ y: 30 }}
              containerComponent={
                <VictoryBrushContainer
                  brushDomain={zoom}
                  onBrushDomainChange={this.updateZoom}
                />
              }
            >
              <VictoryAxis
                dependentAxis
                tickCount={4}
                style={axisStyle}
                tickFormat={this.setLeftPadding}
              />
              <VictoryAxis
                tickCount={10}
                tickFormat={x => this.checkDate(x)}
                style={axisStyle}
              />
              {testData.map(item => (
                <VictoryLine
                  key={item.name}
                  data={item.visible ? item.data : []}
                  style={{
                    data: { stroke: item.color[1] },
                  }}
                />
              ))}
            </VictoryChart>
          </Col>
        </Row>

        <Row>
          <Col className="p-0 col-md-auto">
            <VictoryChart
              padding={chartPadding}
              width={1350}
              height={400}
              style={{ parent: { maxHeight: '400px', maxWidth: '1350px' } }}
              scale={{ x: 'time', y: 'linear' }}
              domainPadding={{ y: 40 }}
              containerComponent={
                <VictoryZoomSelectionContainer
                  zoomDomain={zoom}
                  onSelection={(points, bounds) => this.updateZoom(bounds)}
                  allowPan={false}
                  allowZoom={false}
                />
              }
              externalEventMutations={externalMutation}
            >
              {highlights.length > 0 &&
                highlights.map(item => (
                  <VictoryLine
                    key={item}
                    style={{
                      data: { stroke: 'gray', strokeWidth: 1 },
                    }}
                    x={() => item.x}
                  />
                ))}

              <VictoryScatter
                style={{
                  data: {
                    fill: ({ datum }) =>
                      (datum.alertSummary || hasHighlightedRevision(datum)) &&
                      highlightPoints
                        ? datum.z
                        : '#fff',
                    strokeOpacity: ({ datum }) =>
                      (datum.alertSummary || hasHighlightedRevision(datum)) &&
                      highlightPoints
                        ? 0.3
                        : 100,
                    stroke: ({ datum }) => datum.z,
                    strokeWidth: ({ datum }) =>
                      (datum.alertSummary || hasHighlightedRevision(datum)) &&
                      highlightPoints
                        ? 12
                        : 2,
                  },
                }}
                size={() => 5}
                data={scatterPlotData}
                labels={() => ''}
                labelComponent={
                  <VictoryTooltip
                    flyoutComponent={
                      <GraphTooltip dataPoint={dataPoint} {...this.props} />
                    }
                  />
                }
                events={[
                  {
                    target: 'data',
                    eventHandlers: {
                      onClick: () => {
                        return [
                          {
                            target: 'labels',
                            eventKey: 'all',
                            mutation: props => {},
                          },
                          {
                            target: 'labels',
                            mutation: props => this.setTooltip(props, true),
                          },
                        ];
                      },
                      onMouseOver: () => {
                        return [
                          {
                            target: 'labels',
                            mutation: props => this.setTooltip(props),
                          },
                        ];
                      },
                      onMouseOut: () => {
                        return [
                          {
                            target: 'labels',
                            mutation: props => this.hideTooltip(props),
                          },
                        ];
                      },
                      onMouseDown: evt => evt.stopPropagation(),
                    },
                  },
                ]}
              />
              <VictoryAxis
                dependentAxis
                tickCount={9}
                style={axisStyle}
                tickFormat={this.setLeftPadding}
              />
              <VictoryAxis
                tickCount={6}
                tickFormat={this.setRightPadding}
                style={axisStyle}
                fixLabelOverlap
              />
            </VictoryChart>
          </Col>
        </Row>
      </React.Fragment>
    );
  }
}

GraphsContainer.propTypes = {
  testData: PropTypes.arrayOf(PropTypes.shape({})),
  updateStateParams: PropTypes.func.isRequired,
  zoom: PropTypes.shape({}),
  selectedDataPoint: PropTypes.shape({}),
  highlightAlerts: PropTypes.bool,
  highlightedRevisions: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  timeRange: PropTypes.shape({}).isRequired,
};

GraphsContainer.defaultProps = {
  testData: [],
  zoom: {},
  selectedDataPoint: undefined,
  highlightAlerts: true,
  highlightedRevisions: ['', ''],
};

export default GraphsContainer;
