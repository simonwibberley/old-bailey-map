import L from 'leaflet';
import moment from 'moment';
import {DatumFactory} from '../ts/DatumFactory';

const map = {
    templateUrl : 'html/components/map.html',
    bindings : {
        map : '<'
    },
    controller : function(Datums, $q, $stateParams, $http, $compile, $scope, leafletData, debounce, $window,
                            Queries, Maps, Rows) {
        var $ctrl = this;

        var colours = ['purple', 'green', 'red', 'blue', 'orange', 'black'];


        var DATE_FORMAT = 'YYYY-MM-DD';

        var tilesDict = {
            openstreetmap: {
                url: "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            },
            oldlondon: {
                url: "https://nls-2.tileserver.com/fpsUZba7ERPD/{z}/{x}/{y}.png"
            }
        };

        $scope.getContext = () => {
            alert("blah");
        };



        $ctrl.saveMap = () => {
            Maps.save($stateParams.workspaceId, $ctrl.map.id, $ctrl.map).then(function(map){
                //ok?
            });
        };

        $ctrl.changeTiles = function(tiles) {
            $ctrl.leafletMap.tiles = tilesDict[tiles];
        };

        $ctrl.leafletMap = {
            center: {
                lat: 51.51,
                lng: -0.11,
                zoom: 12
            },

            defaults: {
                //                scrollWheelZoom: true,
                minZoom: 10,
                maxZoom: 14,
                wheelDebounceTime: 100,
                //                scrollWheelZoom:false,
                zoomSnap: 0,
                zoomDelta: 0.1,
                wheelPxPerZoomLevel : 10
            },

            tiles: tilesDict.oldlondon,

            layers: {
                baselayers : {},
                overlays: {}
            }

        };
        
        $ctrl.timelineDuration = 100;

        var timelines = [];
        var timelineControl = null;
        var layerControl = null;

        $ctrl.queries = [];

        $ctrl.$onInit = () => {

            //            $ctrl.map = $ctrl.map || {id:'123', queries:['select1']};

            $ctrl.map.options.heat = $ctrl.map.options.heat || {radius : 10, intensity : 1, history :20, blur:5};

            $ctrl.setHeatBlur = () => {
                leafletData.getLayers().then(function(layers) {
                    if(layers.overlays.heat ) {
                        layers.overlays.heat.setOptions({blur:$ctrl.map.options.heat.blur});
                    }
                    $ctrl.saveMap();
                });
            };

            $ctrl.setHeatRadius = () => {
                leafletData.getLayers().then(function(layers) {
                    if(layers.overlays.heat) {
                        layers.overlays.heat.setOptions({radius:$ctrl.map.options.heat.radius});
                    }
                    $ctrl.saveMap();
                });
            };


            $ctrl.geoKey = Datums.key($ctrl.map.geoKey).key();

            Maps.getQueries($stateParams.workspaceId, $ctrl.map).then((queries) => {
                
                $ctrl.queries = queries;
                
                return Maps.getDateLimits(queries, $ctrl.map).then((bounds) => {
                    $ctrl.minDate = moment(bounds[0]);
                    $ctrl.maxDate = moment(bounds[1]);
                });

            }).then(() => {
                
                drawTimelines();
            });


        }

        var drawTimelines = () => {

            var heatCache = {};

            timelines.forEach( timeline => {
                if(timeline) {
                    timeline.remove();        
                }
            });

            if(timelineControl) {
                timelineControl.remove();
            }

            leafletData.getMap().then(function(map) {

                var dates = [];
                var times = [];

                var date = moment($ctrl.minDate);

                while(date <= $ctrl.maxDate) {
                    var tmp = moment(date);
                    dates.push(tmp.format(DATE_FORMAT));
                    times.push(tmp.add(1000, "y").toDate().getTime())
                    date.add(1, 'days');
                }

                var daysCovered = $ctrl.maxDate.diff($ctrl.minDate, 'days');

                timelineControl = L.timelineSliderControl({
                    steps: daysCovered,
                    start : $ctrl.minDate.add(1000, "y").toDate().getTime(),
                    end: $ctrl.maxDate.add(1000, "y").toDate().getTime(),
                    duration : times.length * 120,

                    // duration : daysCovered * $ctrl.timelineDuration,
                    //                enableKeyboardControls: true,
                    formatOutput: function(date){
                        return moment(date).subtract(1000, "y").format(DATE_FORMAT);
                    }
                });
                
                $ctrl.lineChartData = [];
                $ctrl.lineChartOptions = {
                    chart : {
                        height: 200,
                        x: (d) => {
                            return moment(d[0]).toDate();
                        },
                        y: (d) => {
                            return d[1];
                        },
                        xAxis: {
                            tickFormat: (d) => {
                                return d3.time.format('%Y-%m-%d')(new Date(d));
                            },
                            axisLabel: 'Date'
                        },
                    }
                };

                var lineChartPromises = $ctrl.queries.map( (query, idx) => {

                    return Queries.counts(query, dates).then(counts => {
                        $ctrl.lineChartData.push({
                            key : query._id,
                            values : counts
                        });
                    });
                });

                $q.all(lineChartPromises).then( () => {
                    $ctrl.lineChartDataReady = true;
                });

                var drawHeat = (date) => {

                    var from = moment(date).subtract($ctrl.map.options.heat.history, 'days');//.format(DATE_FORMAT);
                    var to = moment(date);//.format(DATE_FORMAT);

                    var dates = [];
                    var data = [];

                    var date = moment(from);

                    while(date <= to) {
                        var tmp = moment(date);
                        dates.push(tmp.format(DATE_FORMAT));
                        date.add(1, 'days');
                    }

                    var removeIdxs = [];
                    var newCache = {};
                    for(var i = 0; i < dates.length; ++i) {
                        var date = dates[i];
                        if( date in heatCache ) {
                            removeIdxs.push(i);
                            newCache[date] = heatCache[date];
                        }
                    }

                    heatCache = newCache;

                    for(var i = removeIdxs.length-1; i >= 0; --i){
                        var idx = removeIdxs[i];
                        dates.splice(idx, 1);
                    }

                    var promises = $ctrl.queries.map((query) => {
                        return Queries.partitions(query, dates);
                    });

                    $q.all(promises).then(( queryResults )=>{
                        var merged = {};
                        dates.forEach( ( date ) => {
                            merged[date] = [];
                            queryResults.forEach( (queryResult) => {
                                merged[date] = merged[date].concat(queryResult[date]);
                            });

                            merged[date] = Maps.data2geoJson(merged[date], $ctrl.geoKey);
                        });

                        angular.forEach(merged, (value, key)=> {
                            heatCache[key] = value;
                        });

                        var i = 0;

                        for(var d = moment(from); d.diff(to, 'days') <= 0; d.add(1, 'days') ) {
                            var dayDate = moment(d).format(DATE_FORMAT);
                            if(dayDate in heatCache) {
                                var dayData = heatCache[dayDate].features;

                                var intensity = (i / $ctrl.map.options.heat.history) * $ctrl.map.options.heat.intensity;

                                for(var j = 0; j < dayData.length; ++j) {
                                    var point = [dayData[j].geometry.coordinates[1],dayData[j].geometry.coordinates[0]];
                                    data.push(point.concat(intensity));
                                }
                            }

                            ++i;
                        }
                        if(!data) return;

                        leafletData.getLayers().then(function(layers) {
                            if(layers.overlays.heat) {
                                if(layers.overlays.heat._map) {
                                    layers.overlays.heat.setLatLngs(data);
                                }
                            } else {
                                var heatOptions = {
                                    name: 'Heat Map',
                                    type: 'heat',
                                    data: data,
                                    layerOptions: {
                                        radius: $ctrl.map.options.heat.radius,
                                        blur: $ctrl.map.options.heat.blur
                                    },
                                    visible: true
                                };

                                //                                L.heatLayer(heatOptions).addTo(map);
                                //
                                $ctrl.leafletMap.layers.overlays = {
                                    heat : heatOptions
                                };
                            }
                        });
                    });
                }

                var markerClusterOptions = {
//                    iconCreateFunction : iconCreateFunction,
                    clockHelpingCircleOptions: {
                        weight: 0.7,
                        opacity: 1,
                        color: "black",
                        fillOpacity: 0,
                        dashArray: "10 5",
                    },
                    maxClusterRadius : 30,
                    helpingCircles : true,
                    elementsPlacementStrategy : 'default',
                    spiderLegPolylineOptions : {weight: 1},
                    spiderfyDistanceMultiplier: 1.1,
                    zoomToBoundsOnClick : false,
                    spiderfyOnMaxZoom : false,
                    singleMarkerMode : false
                };

//                var clusters = L.markerClusterGroup();
                var clusters = L.markerClusterGroup.layerSupport(markerClusterOptions);

                clusters.on('clusterclick', function(e){
                    var cluster = e.layer;
                    cluster.spiderfy();
                });


                timelines = $ctrl.queries.map( (query, idx) => {

                    var timeline = L.timeline(null, {
                        start : $ctrl.minDate.add(1000, "y").toDate().getTime(),
                        end: $ctrl.maxDate.add(1000, "y").toDate().getTime(),
                        // getInterval: getInterval,
                        drawOnSetTime: true,
                        pointToLayer: function(data, latlng) {
                            var colour = colours[idx];

                            return L.circleMarker(latlng, {radius:5, color:colour}).bindPopup(function(l) {

                                var lat = Math.round10(latlng.lat, -5);
                                var lng = Math.round10(latlng.lng, -5);

                                var displayKeys = {};
                                displayKeys[Datums.key($ctrl.map.geoKey).key()] = true;

                                var row = Rows.getRowsColumns([data.datum], $ctrl.map.keys, displayKeys);

                                var datum = Datums.datum(data.datum, $ctrl.map.keys);

                                var contextId = data.datum[Datums.key($ctrl.map.contextKey).key()];
                                var entryId = data.datum[Datums.key($ctrl.map.entryKey).key()];
                                var spans = datum.get(spansKey);

                                var localScope = $scope.$new();
                                localScope.data = data;
                                var spanColumn = {};
                                spanColumn.text = datum.get(datum.resolve(spans.target).target);
                                spanColumn.spans = [spans];
                                localScope.spanColumn = spanColumn;

                                data.contextId = contextId;
                                data.entryId = entryId;

                                var docRef = $ctrl.map.geoKey;

                                return $compile("<ul>" +
                                    '<li><a  ng-click="getContext()">{{data.entryId}}</a></li>' +
                                        '<span-text spanss="spanColumn"> </span-text>'
                                        +
                                        // "<li>Match: " + match + "</li>"+
                                        // "<li>Original: " + data.metadata.spanned + "</li>"+
                                        "<li>lat/lng: " + lat  + ", " + lng + "</li>"+
                                        // "<li>Date: " + data.metadata.date + "</li>"+
                                        // "<li>Trial: " + data.metadata.trialId + "</li>"+
                                    "</ul>")(localScope)[0];
                            });
                        }
                    });
                    timeline.times = times;
                    timelineControl.addTo(map);
                    timelineControl.addTimelines(timeline);

                    timeline.addTo(clusters);
                    clusters.checkIn(timeline);

                    timeline.addTo(map);
                    timeline.on('change', function(e){
                        $ctrl.selectedDate = moment(e.target.time).subtract(1000, "y").toDate();
                        Maps.getData(query, $ctrl.map, $ctrl.selectedDate)
                            .then(featureCollection => {
                                timeline.addData(featureCollection);
                            });
                        drawHeat($ctrl.selectedDate);
                    });
                    return timeline;
                });

                var overlays = {};
                
                for(var i = 0; i < $ctrl.queries.length; ++i) {
                    overlays[$ctrl.queries[i]._id] = timelines[i];
                }

                clusters.addTo(map);
                map.addLayer(clusters);

                layerControl = L.control.layers(null, overlays).addTo(map);

            });
        };
    }
};

export default map;
