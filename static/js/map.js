var ambulanceMarkers = {};  // Store ambulance markers
var ambulances = {};	// Store ambulance details

var hospitalMarkers = {};  // Store hospital markers
var hospitals = {};	// Store hospital details

var locationMarkers = {};  // Store location markers
var locations = {};	// Store location details

// Initialize category layers
var visibleCategory = {};
var markersByCategory = {};
var categoryGroupLayers = {};

// add ambulance_status
Object.keys(ambulance_status).forEach(function(status) {
    markersByCategory[status] = [];
    visibleCategory[status] = true;
});

// add hospital
var category = 'Hospital';
markersByCategory[category] = [];
visibleCategory[category] = true;

// add location_type
Object.keys(location_type).forEach(function(type) {
    markersByCategory[type] = [];
    visibleCategory[type] = false;
});


// Initialize marker icons.
var ambulanceIcon = L.icon({
	//iconUrl: '/static/icons/ambulance_icon.png',
	iconUrl: '/static/icons/cars/ambulance_red.svg',
	iconSize: [60, 60],
});
var ambulanceIconBlack = L.icon({
	// iconUrl: '/static/icons/ambulance_icon_black.png',
	iconUrl: '/static/icons/cars/ambulance_black.svg',
	iconSize: [60, 60],
});
var ambulanceIconBlue = L.icon({
	// iconUrl: '/static/icons/ambulance_blue.png',
	iconUrl: '/static/icons/cars/ambulance_blue.svg',
	iconSize: [60, 40],
});
var hospitalIcon = L.icon({
	iconUrl: '/static/icons/hospital_icon.png',
	iconSize: [40, 40]
});
var locationIcon = L.icon({
	iconUrl: '/static/icons/place_marker.png',
	iconSize: [40, 40],
	iconAnchor: [20, 40],
	popupAnchor: [0,-40]

});

// TODO: different icons for different location types
// TODO: different colors for ambulance status
// TODO: better hospital icon

/**
 * Ambulance statuses 
 */

var STATUS_AVAILABLE = "AV";
var STATUS_OUT_OF_SERVICE = "OS";

// global variable for mqttClient
var mqttClient;

// TODO: remove hardcoded mapbox access_token

/**
 * This is a handler for when the page is loaded.
 */
var mymap;
$(document).ready(function () {

    // Set map view
    mymap = L.map('live-map').setView([32.5149, -117.0382], 12);

    // Add layer to map.
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoieWFuZ2Y5NiIsImEiOiJjaXltYTNmbTcwMDJzMzNwZnpzM3Z6ZW9kIn0.gjEwLiCIbYhVFUGud9B56w', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox.streets',
        accessToken: 'pk.eyJ1IjoieWFuZ2Y5NiIsImEiOiJjaXltYTNmbTcwMDJzMzNwZnpzM3Z6ZW9kIn0.gjEwLiCIbYhVFUGud9B56w'
    }).addTo(mymap);

    // Add the drawing toolbar and the layer of the drawings.
    var drawnItems = new L.FeatureGroup();
    mymap.addLayer(drawnItems);
    var drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        }
    });
    mymap.addControl(drawControl);

    // Event handler for when something is drawn. Only handles 
    // when a new drawing is made for now.
    mymap.on(L.Draw.Event.CREATED,
        function (e) {
            var type = e.layerType;
            layer = e.layer;
            if (type === 'marker') {
                // Do marker specific actions
            }
            // Do whatever else you need to. (save to db; add to map etc)
            mymap.addLayer(layer);
        });

    // Create status filter on the right hand top corner
    createCategoryFilter(mymap);

    // Submit form
    $('#dispatchForm').submit(function (e) {
        e.preventDefault();
        postDispatchCall();
    })

    // retrieve temporary password for mqttClient and connect to broker
    $.getJSON(APIBaseUrl + 'user/' + username + '/password/', function (password) {

        // create mqtt broker client
        mqttClient = new Paho.MQTT.Client(MQTTBroker.host,
            MQTTBroker.port,
            clientId);

        // set callback handlers
        mqttClient.onMessageArrived = onMessageArrived;

        // attempt to connect to MQTT broker
        mqttClient.connect({
            //connection attempt timeout in seconds
            timeout: 60,
            userName: username,
            password: password,
            useSSL: true,
            cleanSession: true,
            onSuccess: onConnect,
            onFailure: onConnectFailure,
        });

    })
        .fail(function (jqxhr, textStatus, error) {

            alert("Connection to MQTT broker failed: \"" +
                testStatus + "," + error + "\"\n" +
                "Information will not be updated in real time.");

        });

});

/* Handle connect */
function onConnect() {

    console.log("Connected to MQTT broker");

    // retrieve profile from api
    console.log("Retrieving profile from API");
    $.getJSON(APIBaseUrl + 'user/' + username + '/profile/', function (data) {

        // Subscribe to hospitals
        $.each(data.hospitals, function (index) {
            let topicName = "hospital/" + data.hospitals[index].hospital_id + "/data";
            mqttClient.subscribe(topicName);
            console.log('Subscribing to topic: ' + topicName);
        });

        // Subscribe to ambulances
        $.each(data.ambulances, function (index) {
            let topicName = "ambulance/" + data.ambulances[index].ambulance_id + "/data";
            mqttClient.subscribe(topicName);
            console.log('Subscribing to topic: ' + topicName);
        });

    });

    // retrieve locations from api
    console.log("Retrieving locations from API");
    $.getJSON(APIBaseUrl + 'location/', function (data) {

        // add location
        $.each(data, function (index) {
        	addLocationToMap(data[index]);
        });
        
    });

    // publish to mqtt on status change from details options dropdown
    $('#ambulance-detail-status-select').change(function () {

        // Get status
        status = JSON.stringify({'status': this.value});

        // Send message
        let id = $('#ambulance-detail-id').val();
        let topic = "user/" + username + "/ambulance/" + id + "/data";
        let message = new Paho.MQTT.Message(status);
        message.destinationName = topic
        message.qos = 2;
        mqttClient.send(message);
        console.log('Sent message: "' + topic + ':' + status + '"');

    });

};

/* Handle missconnection */
function onConnectFailure(message) {

    alert("Connection to MQTT broker failed: " + message.errorMessage +
        "Information will not be updated in real time.");

    // Load hospital data from API
    $.ajax({
        type: 'GET',
        datatype: "json",
        url: APIBaseUrl + 'hospital/',

        error: function (msg) {

            alert('Could not retrieve data from API:' + msg)

        },

        success: function (data) {

            console.log('Got data from API')

            $.each(data, function (i, hospital) {

                // update hospital
                updateHospital(hospital);

            });
        }
    })
        .done(function (data) {
            if (console && console.log) {
                console.log("Done retrieving hospital data from API");
            }
        });

    // Load ambulance data from API
    $.ajax({
        type: 'GET',
        datatype: "json",
        url: APIBaseUrl + 'ambulance/',

        error: function (msg) {

            alert('Could not retrieve data from API:' + msg)

        },

        success: function (data) {

            console.log('Got data from API')

            $.each(data, function (i, ambulance) {

                // update ambulance
                updateAmbulance(ambulance);

            });
        }
    })
        .done(function (data) {
            if (console && console.log) {
                console.log("Done retrieving ambulance data from API");
            }
        });

};

/* Handle 'ambulance/+/data' mqtt messages */
function onMessageArrived(message) {

    console.log('Message "' +
        message.destinationName + ':' + message.payloadString +
        '" arrived');

    // split topic
    let topic = message.destinationName.split("/");

    try {

        // parse message
        let data = JSON.parse(message.payloadString);

        // Look for ambulance/{id}/data
        if (topic[0] === 'ambulance' &&
            topic[2] == 'data') {
            updateAmbulance(data);
        }

        // Look for ambulance/{id}/data
        else if (topic[0] === 'hospital' &&
            topic[2] == 'data') {
            updateHospital(data);
        }

    } catch (e) {
        alert('Error processing message "' +
            message.destinationName + ':' + message.payloadString +
            '"' + '<br/>' + 'error = "' + e + '"');
    }

};

function updateAmbulance(ambulance) {

    // retrieve id
    let id = ambulance.id;

    // already exists?
    if (id in ambulances) {

        // Remove existing marker
        let marker = ambulanceMarkers[id];
        let status = ambulances[id].status;
        let index = markersByCategory[status].indexOf(marker);
        if (index >= 0) {
            markersByCategory[status].splice(index, 1);
        }
        mymap.removeLayer(marker);

        // update ambulance
        ambulances[id].status = ambulance.status;
        ambulances[id].location.latitude = ambulance.location.latitude;
        ambulances[id].location.longitude = ambulance.location.longitude;
        ambulances[id].orientation = ambulance.orientation;

        // Overwrite ambulance
        ambulance = ambulances[id]

        // Update ambulance grid
        var buttonId = "#grid-button" + id;

        // Updated button color/status
        if (ambulance.status === STATUS_AVAILABLE)
            $(buttonId).attr("class", "btn btn-success");
        else if (ambulance.tatus === STATUS_OUT_OF_SERVICE)
            $(buttonId).attr("class", "btn btn-default");
        else
            $(buttonId).attr("class", "btn btn-danger");

    } else {

        // Add ambulance to grid
        addAmbulanceToGrid(ambulance);
    }

    // add ambulance to map
    addAmbulanceToMap(ambulance);

    // update detail panel
    updateDetailPanel(ambulance);

};

function updateHospital(hospital) {

    // retrieve id
    let id = hospital.id;

    // already exists?
    if (id in hospitals) {

        // update hospital
        hospitals[id].location.latitude = hospital.location.latitude;
        hospitals[id].location.longitude = hospital.location.longitude;

        // Remove existing marker
        mymap.removeLayer(hospitalMarkers[id]);

        // Overwrite hospital
        hospital = hospitals[id]

    }

    // add hospital to map
    addHospitalToMap(hospital);

};

function addAmbulanceToGrid(ambulance) {

    console.log('Adding ambulance "' + ambulance.identifier +
        '[id=' + ambulance.id + ']"' +
        ' to grid');

    let button_class_name = 'btn-danger';
    if (ambulance.status === STATUS_AVAILABLE) {
        button_class_name = 'btn-success';

        $('#ambulance-selection')
            .append('<label><input type="checkbox"' +
                ' name="ambulance_assignment" value="' +
                ambulance.id + '"> Ambulance ' +
                ambulance.identifier + ' </label><br/>');

    }
    else if (ambulance.status === STATUS_OUT_OF_SERVICE) {

        button_class_name = 'btn-default';

    }

    // Add to grid
    $('#ambulance-grid')
        .append('<button type="button"' +
            ' id="' + 'grid-button' + ambulance.id + '"' +
            ' class="btn ' + button_class_name + '"' +
            ' style="margin: 5px 5px;">' +
            ambulance.identifier + '</button>');

    // Open popup on panel click.
    // For some reason, only works when I create a separate function as opposed to creating a function within the click(...)
    $('#grid-button' + ambulance.id).click(
        onGridButtonClick(ambulance.id, mymap)
    );

};

function addAmbulanceToMap(ambulance) {

    console.log('Adding ambulance "' + ambulance.identifier +
        '[id=' + ambulance.id + ']"' +
        '[' + ambulance.location.latitude + ' ' +
        ambulance.location.longitude + '] ' +
        ' to map');

    // store ambulance details in an array
    ambulances[ambulance.id] = ambulance;

    // set icon by status
    let coloredIcon = ambulanceIcon;
    if (ambulance.status === STATUS_AVAILABLE)
        coloredIcon = ambulanceIconBlue;
    else if (ambulance.status === STATUS_OUT_OF_SERVICE)
        coloredIcon = ambulanceIconBlack;

    // Add marker
    ambulanceMarkers[ambulance.id] = L.marker(
        [ambulance.location.latitude,
            ambulance.location.longitude],
        {
            icon: coloredIcon,
            rotationAngle: 360 - ambulance.orientation
        })
        .bindPopup(
            "<strong>" + ambulance.identifier +
            "</strong>" +
            "<br/>" +
            ambulance_capability[ambulance.capability] +
            "<br/>" +
            ambulance_status[ambulance.status]
        ).addTo(mymap);

    // Bind id to icons
    ambulanceMarkers[ambulance.id]._icon.id = ambulance.id;

    // Collapse panel on icon hover.
    ambulanceMarkers[ambulance.id]
        .on('mouseover',
            function (e) {
                // open popup bubble
                this.openPopup().on('mouseout',
                    function (e) {
                        this.closePopup();
                    });
            })
        .on('click',
            function (e) {

                // update details panel
                updateDetailPanel(ambulance);

                // add to dispatching list
                if (isDispatching) {

                    if (!(ambulance.id in dispatchingAmbulances)) {

                        // add ambulance to list of dispatching ambulances
                        dispatchingAmbulances[ambulance.id] = true;

                        // add button to grid
                        $('#ambulance-selection').append(
                            '<button type="button" class="btn btn-sm" data-color="danger">'
                            + ambulance.identifier
                            + '</button>';

                    }
                }
            });

    // Add to a map to differentiate the layers between statuses.
    markersByCategory[ambulance.status].push(ambulanceMarkers[ambulance.id]);

    // If layer is not visible, remove marker
    if (!visibleCategory[ambulance.status]) {
        let marker = ambulanceMarkers[ambulance.id];
        categoryGroupLayers[ambulance.status].removeLayer(marker);
        mymap.removeLayer(marker);
    }

};

function addHospitalToMap(hospital) {

    console.log('Adding hospital "' + hospital.name +
        '[id=' + hospital.id + ']"' +
        '[' + hospital.location.latitude + ' ' +
        hospital.location.longitude + '] ' +
        ' to map');

    // store hospital details in an array
    hospitals[hospital.id] = hospital;

    // set icon by status
    let coloredIcon = hospitalIcon;

    // If hospital marker doesn't exist
    hospitalMarkers[hospital.id] = L.marker([hospital.location.latitude,
            hospital.location.longitude],
        {icon: coloredIcon})
        .bindPopup("<strong>" + hospital.name + "</strong>")
        .addTo(mymap);

    // Bind id to icons
    hospitalMarkers[hospital.id]._icon.id = hospital.id;

    // Collapse panel on icon hover.
    hospitalMarkers[hospital.id]
        .on('mouseover',
            function (e) {
                // open popup bubble
                this.openPopup().on('mouseout',
                    function (e) {
                        this.closePopup();
                    });
            });

    // Add to a map to differentiate the layers between statuses.
	let category = 'Hospital'
    markersByCategory[category].push(hospitalMarkers[hospital.id]);

    // If layer is not visible, remove marker
    if (!visibleCategory[category]) {
        let marker = hospitalMarkers[hospital.id];
        categoryGroupLayers[category].removeLayer(marker);
        mymap.removeLayer(marker);
    }

};

function addLocationToMap(location) {

    // TODO: Separate icons by layers depending on type

    console.log('Adding location "' + location.name +
        '[id=' + location.id + ']"' +
        '[' + location.location.latitude + ' ' +
        location.location.longitude + '] ' +
        ' to map');

    // store location details in an array
    locations[location.id] = location;

    // set icon by status
    let coloredIcon = locationIcon;

    // If location marker doesn't exist
    locationMarkers[location.id] = L.marker([location.location.latitude,
            location.location.longitude],
        {icon: coloredIcon})
        .bindPopup("<strong>" + location.name + "</strong>")
        .addTo(mymap);

    // Bind id to icons
    locationMarkers[location.id]._icon.id = location.id;

    // Collapse panel on icon hover.
    locationMarkers[location.id]
        .on('mouseover',
            function (e) {
                // open popup bubble
                this.openPopup().on('mouseout',
                    function (e) {
                        this.closePopup();
                    });
            });

    // Add to a map to differentiate the layers between typees.
    markersByCategory[location.type].push(locationMarkers[location.id]);

    // If layer is not visible, remove marker
    if (!visibleCategory[location.type]) {
        let marker = locationMarkers[location.id];
        categoryGroupLayers[location.type].removeLayer(marker);
        mymap.removeLayer(marker);
    }
    
};

/*
 * updateDetailPanel updates the detail panel with the ambulance's details.
 * @param ambulanceId is the unique id used in the ajax call url.
 * @return void.
 */
function updateDetailPanel(ambulance) {

    $('#ambulance-detail-name')
        .html(ambulance.identifier);
    $('#ambulance-detail-capability')
        .html(ambulance_capability[ambulance.capability]);
    $('#ambulance-detail-updated-on')
        .html(ambulance.updated_on);

    $('#ambulance-detail-status-select')
        .val(ambulance.status);
    $('#ambulance-detail-id')
        .val(ambulance.id);

}

/* Create status filter on the top right corner of the map */
function createCategoryFilter(mymap) {

    // Add the checkbox on the top right corner for filtering.
    var container = L.DomUtil.create('div', 'filter-options');

    //Generate HTML code for checkboxes for each of the statuses.
    var filterHtml = "";

    filterHtml += '<div style="border-style: solid; border-radius: 5px; padding: 0px 5px 0px 5px; margin: 0px 0px 0px 0px">';
    Object.keys(ambulance_status).forEach(function (status) {

        categoryGroupLayers[status] = L.layerGroup(markersByCategory[status]);
        categoryGroupLayers[status].addTo(mymap);

        filterHtml += '<div class="checkbox"><label><input class="chk" data-status="' 
            + status + '" type="checkbox" value="" '
            + (visibleCategory[status] ? 'checked' : '') + '>'
            + ambulance_status[status] + "</label></div>";

    });
    filterHtml += "</div>";

    //Generate HTML code for checkboxes for hospital
    filterHtml += '<div style="border-style: solid; border-radius: 5px; padding: 0px 5px 0px 5px; margin: 0px 0px 0px 0px">';
    let category = 'Hospital'
    categoryGroupLayers[category] = L.layerGroup(markersByCategory[category]);
    categoryGroupLayers[category].addTo(mymap);
    filterHtml += '<div class="checkbox"><label><input class="chk" data-status="' 
        + category + '" type="checkbox" value="" '
        + (visibleCategory[category] ? 'checked' : '') + '>'
        + category + "</label></div>";
    filterHtml += "</div>";

    //Generate HTML code for checkboxes for locations
    filterHtml += '<div style="border-style: solid; border-radius: 5px; padding: 0px 5px 0px 5px; margin: 0px 0px 0px 0px">';
    Object.keys(location_type).forEach(function (type) {

        categoryGroupLayers[type] = L.layerGroup(markersByCategory[type]);
        categoryGroupLayers[type].addTo(mymap);

        filterHtml += '<div class="checkbox"><label><input class="chk" data-status="' 
            + type + '" type="checkbox" value="" '
            + (visibleCategory[type] ? 'checked' : '') + '>'
            + location_type[type] + "</label></div>";

    });
    filterHtml += "</div>";

    // Append html code to container
    container.innerHTML = filterHtml;

    // Add the checkboxes.
    var customControl = L.Control.extend({

        options: {
            position: 'topright'
        },

        onAdd: function (map) {
            return container;
        }

    });
    mymap.addControl(new customControl());

    // Add listener to remove status layer when filter checkbox is clicked
    $('.chk').change(function () {

        // Which layer?
        status = this.getAttribute('data-status');

        // Clear layer
        categoryGroupLayers[status].clearLayers();

        if (this.checked) {

            // Add the ambulances in the layer if it is checked.
            markersByCategory[status].forEach(function (marker) {
                categoryGroupLayers[status].addLayer(marker)
            });
            visibleCategory[status] = true;

        } else {

            // Remove from layer if it is not checked.
            markersByCategory[status].forEach(function (marker) {
                categoryGroupLayers[status].removeLayer(marker);
                mymap.removeLayer(marker);
            });
            visibleCategory[status] = false;

        }

    });

};


function onGridButtonClick(ambulanceId, mymap) {
    return function (e) {

        let ambulance = ambulances[ambulanceId]

        // Update detail panel
        updateDetailPanel(ambulance);

        if (visibleCategory[ambulance.status]) {

            // Center icon on map
            var position = ambulanceMarkers[ambulanceId].getLatLng();
            mymap.setView(position, mymap.getZoom());

            // Open popup for 2.5 seconds.
            ambulanceMarkers[ambulanceId].openPopup();
            setTimeout(function () {
                ambulanceMarkers[ambulanceId].closePopup();
            }, 2500);

        }

    }
}
