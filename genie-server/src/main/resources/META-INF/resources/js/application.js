define([
    'jquery',
    'underscore',
    'knockout',
    'knockout.mapping',
    'pager',
    'loadKoTemplate!../templates/application-search-form.html',
    'loadKoTemplate!../templates/application-search-results.html',
    'loadKoTemplate!../templates/application-details.html'
], function($, _, ko, mapping, pager) {
    ko.mapping = mapping;

    function Application(json) {
        var self = this;
        self.objStatus        = ko.observable('ready');
        self.created      = ko.observable();
        self.version    = ko.observable();
        self.id               = ko.observable();
        self.name             = ko.observable();
        self.status           = ko.observable();
        self.updated      = ko.observable();
        self.user             = ko.observable();
        self.configs = ko.observableArray();
        self.jars = ko.observableArray();
        self.tags = ko.observableArray();

        ko.mapping.fromJS(json, {}, self);
        self.originalStatus = self.status();

        self.idFormatted = ko.computed(function() {
            var idLength = self.id() ? self.id().length : -1;
            if (idLength > 30) {
                return self.id().substring(0,20) + '...' + self.id().substring(idLength-10);
            }
            return self.id();
        }, self);
        
        self.createTimeFormatted = ko.computed(function() {
            if (self.created() > 0) {
                var myDate = new Date(parseInt(self.created()));
                return myDate.toUTCString();
            }
            return '';
        }, self);

        self.updateTimeFormatted = ko.computed(function() {
            if (self.updated() > 0) {
                var myDate = new Date(parseInt(self.updated()));
                return myDate.toUTCString();
            }
            return '';
        }, self);

        self.statusClass = ko.computed(function() {
            if (self.status() && self.status().toUpperCase() === 'ACTIVE') {
                return 'label-success';
            }
            return '';
        }, self);

        self.updateStatus = function() {
            self.objStatus('updating');
            $.ajax({
                type: 'PUT',
                headers: {'content-type':'application/json', 'Accept':'application/json'},
                url: 'genie/v2/config/applications/'+self.id(),
                data: JSON.stringify({status: self.status()})
            }).done(function(data) {
                self.objStatus('ready');
                location.reload(true);
            }).fail(function(jqXHR, textStatus, errorThrown) {
                self.objStatus('ready');
                self.status(self.originalStatus);
            });
        };
    };

    var ApplicationViewModel = function() {
        this.Application = {};
        var self = this.Application;
        self.status = ko.observable('');
        self.current = ko.observable(new Application());
        self.searchResults = ko.observableArray();
        self.searchDateTime = ko.observable();
        self.runningApplications = ko.observableArray();
        self.allTags = ko.observableArray();
        self.selectedTags = ko.observableArray();

        self.applicationOrderByFields = ko.observableArray(['user','started','created','id','name','status']);
        self.applicationOrderBySelectedFields = ko.observableArray();

        self.runningApplicationCount = ko.computed(function() {
            return _.reduce(self.runningApplications(), function(sum, obj, index) { return sum + obj.count; }, 0);
        }, self);
        
        self.startup = function() {
            self.runningApplications([]);
            var applicationCount = {};
            $.ajax({
                global: false,
                type: 'GET',
                headers: {'Accept':'application/json'},
                url:  'genie/v2/config/applications?status=ACTIVE'
            }).done(function(data) {
            	if (data instanceof Array) {
                    _.each(data, function(applicationObj, index) {
                        if (!(applicationObj.status in applicationCount)) {
                            applicationCount[applicationObj.status] = 0;
                        }
                        applicationCount[applicationObj.status] += 1;
                        _.each(applicationObj.tags, function(tag, index) {
                        	if (self.allTags.indexOf(tag) < 0) {
                        		self.allTags.push(tag);
                        	}
                        });
                    });
                    $("#applicationSearchTags").select2();
                } else {
                    var applicationObj = data;
                    if (!(applicationObj.status in applicationCount)) {
                        applicationCount[applicationObj.status] = 0;
                    }
                    applicationCount[applicationObj.status] += 1                    
                }
                _.each(applicationCount, function(count, status) {
                    self.runningApplications.push({status: status, count: count});
                });
                $("#applicationOrderFields").select2();
            });
        };

        self.search = function() {
            var d = new Date();
            self.searchResults([]);
            self.status('searching');
            self.searchDateTime(d.toLocaleString());
            
            var formArray = $('#applicationSearchForm').serializeArray();
            var name     = _.where(formArray, {'name': 'name'})[0].value;
            var status   = _.where(formArray, {'name': 'status'})[0].value;
            var limit    = _.where(formArray, {'name': 'limit'})[0].value;

            var sortOrder = _.where(formArray, {'name': 'sortOrder'})[0].value;
            var bDescending =  true;

            if (sortOrder != 'descending') {
                bDescending = false;
            }

            $.ajax({
                global: false,
                type: 'GET',
                headers: {'Accept':'application/json'},
                url:  'genie/v2/config/applications',
                traditional: true,
                data: {limit: limit, name: name, status: status, tag: self.selectedTags(), orderBy: self.applicationOrderBySelectedFields(), descending: bDescending}
            }).done(function(data) {
            	self.searchResults([]);
                self.status('results');
                if (data instanceof Array) {
                    _.each(data, function(applicationObj, index) {

                        applicationObj.idLink  = $("<div />").append($("<a />", {
                            href : '/#application/details/'+applicationObj.id,
                            target: "_blank"
                        }).append($("<img/>", {src: '../images/genie.gif', class: 'genie-icon'}))).html();

                        applicationObj.rawLink  = $("<div />").append($("<a />", {
                            href : "genie/v2/config/applications/" + applicationObj.id,
                            target: "_blank"
                        }).append($("<img/>", {src: '../images/json_logo.png', class: 'json-icon'}))).html();

                        self.searchResults.push(new Application(applicationObj));
                    });
                } else {
                    self.searchResults.push(new Application(data));
                }

                var table = $("#applicationDataTable").DataTable ();
                table.destroy();
                $("#applicationDataTable").DataTable ( {
                        data: self.searchResults(),
                        columns: [
                            { data: 'id' },
                            { data: 'name' },
                            { data: 'user', className: "dt-center"},
                            { data: 'version', className: "dt-center"},
                            { data: 'tags'},
                            { data: 'created', className: "dt-center"},
                            { data: 'updated', className: "dt-center"},
                            { data: 'idLink', className: "dt-center"},
                            { data: 'rawLink', className: "dt-center"}
                        ]
                    }
                )

            }).fail(function(jqXHR, textStatus, errorThrown) {
                console.log(jqXHR, textStatus, errorThrown);
                self.status('results');
            });
        };

        self.update = function(page) {
            if (page) {
                var applicationId = page.page.currentId;
                $.ajax({
                    type: 'GET',
                    headers: {'Accept':'application/json'},
                    url:  'genie/v2/config/applications/'+applicationId
                }).done(function(data) {
                	console.log(data);
                    self.current(new Application(data));
                });
            } else {
                self.current(new Application());
            }
        };

    };

    return ApplicationViewModel;
});
