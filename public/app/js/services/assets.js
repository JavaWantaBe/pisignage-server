'use strict';

/*
 $scope.files holds all the files present in the media directory
 $scope.filesDetails contains db data for the files with $scope.files element as key
 $scope.groupWiseAssets holds object with playlist name as key
 object contains playlist and assets fields
 assets contains array with each element is an object of fileDetails, playlistDetails for that file & deleted attribute
 $scope.includedAssets contains all the included assets in all playlists
 $scope.allAseets contains all assets with fileDetails, playlistDetails attributes
 */

angular.module('piAssets.services', [])
    .factory('assetLoader', function ($http,$state,piUrls,piConstants,$rootScope) {
        let observerCallbacks = {};

        let notifyObservers = function(){
            if (!assetLoader.asset.groupWiseAssets)        //not yet loaded
                return;
            assetLoader.asset.showAssets = assetLoader.playlist.selectedPlaylist ?
                assetLoader.asset.groupWiseAssets[assetLoader.playlist.selectedPlaylist.name] : assetLoader.asset.allAssets;

            angular.forEach(observerCallbacks, (callback) => {
                callback();
            });
        };

        let assemblePlaylistAssets = function() {
            assetLoader.asset.groupWiseAssets = {};

            assetLoader.playlist.playlists.forEach(function (playlist) {
                assetLoader.asset.groupWiseAssets[playlist.name] = {
                    playlist: playlist,
                    assets: []
                };
                playlist.assets.forEach(function (asset) {

                    if (asset === null)
                        return;

                    let obj = {};

                    obj.fileDetails = assetLoader.asset.filesDetails[asset.filename] || {name: asset.filename};
                    obj.playlistDetails = asset;
                    obj.deleted = (assetLoader.asset.files.indexOf(asset.filename) === -1) &&
                        (asset.filename.indexOf("_system") !== 0);
                    assetLoader.asset.groupWiseAssets[playlist.name].assets.push(obj);

                    /*if (asset.side) {
                        var obj = {};
                        obj.fileDetails = assetLoader.asset.filesDetails[asset.side] || {name: asset.side};
                        obj.playlistDetails = null;
                        obj.deleted = (assetLoader.asset.files.indexOf(asset.filename) == -1);
                        assetLoader.asset.groupWiseAssets[playlist.name].assets.push(obj)
                    }
                    if (asset.bottom) {
                        var obj = {};
                        obj.fileDetails = assetLoader.asset.filesDetails[asset.bottom] || {name: asset.bottom};
                        obj.playlistDetails = null;
                        obj.deleted = (assetLoader.asset.files.indexOf(asset.filename) == -1);
                        assetLoader.asset.groupWiseAssets[playlist.name].assets.push(obj)
                    }*/

                });
            });
            assetLoader.asset.allAssets = {
                playlist: null,
                assets: []
            };
            assetLoader.asset.files.forEach(function (filename) {
                //if ($scope.includedAssets.indexOf(filename) == -1) {
                let obj = {};

                obj.fileDetails = assetLoader.asset.filesDetails[filename] || {name: filename};
                obj.playlistDetails = {filename: filename, selected: false};
                obj.playlistDetails.isVideo = !(filename.match(piConstants.videoRegex) === null);
                obj.playlistDetails.option = obj.playlistDetails.option ||  {main:false};

                if (assetLoader.asset.filesDetails[filename])
                    obj.playlistDetails.duration = parseInt(assetLoader.asset.filesDetails[filename].duration);

                obj.playlistDetails.duration = obj.playlistDetails.duration || $rootScope.serverConfig.defaultDuration;
                assetLoader.asset.allAssets.assets.push(obj);
                //}
            });
            notifyObservers();
        };

        let loadAllModels = function() {
            async.series([
                    function (next) {
                        $http.get(piUrls.labels)
                            .success(function (data, status) {
                                if (data.success) {
                                    assetLoader.label.labels = data.data;
                                }
                                next();
                            })
                            .error(function (data, status) {
                                next();
                            });
                    },
                    function (next) {
                        $http.get(piUrls.files, {})
                            .success(function (data, status) {
                                if (data.success) {
                                    assetLoader.asset.files = data.data.files;
                                    if (data.data.dbdata) {
                                        assetLoader.asset.filesDetails = {};
                                        data.data.dbdata.forEach( (dbdata) => {
                                            if (assetLoader.asset.files.indexOf(dbdata.name) >= 0) {
                                                assetLoader.asset.filesDetails[dbdata.name] = dbdata;
                                            }
                                        });
                                        assetLoader.updateLabelsCount();
                                    }
                                }
                                next();
                            })
                            .error(function (data, status) {
                                next();
                            });
                    },
                    function (next) {
                        $http
                            .get(piUrls.playlists, {})
                            .success( (data, status) => {
                                if (data.success) {
                                    assetLoader.playlist.playlists = data.data;
                                }
                                next();
                            })
                            .error(function (data, status) {
                                next();
                            });
                    }
                ], function (err) {
                    assetLoader.label.selectedLabel = null;
                    assetLoader.label.selectedPlayerLabel = null;
                    assetLoader.playlist.selectedPlaylist = null;
                    assemblePlaylistAssets();
                }
            );
        };

        let assetLoader = {
            asset: {
                files: [],
                filesDetails: {},

                groupWiseAssets: null,
                allAssets: null,
                showAssets: null
            },

            playlist: {
                playlists: [],
                selectedPlaylist: null
            },

            label : {
                labels: [],
                selectedLabel: null,
                selectedPlayerLabel: null,
                labelsCount: {}
            },

            assemblePlaylistAssets: function() {
                assemblePlaylistAssets();
            },

            reload: function() {
                loadAllModels();
            },

            updateLabelsCount: function() {
                Object.keys(assetLoader.label.labelsCount).forEach( (item) => {
                    if (!item.mode || item.mode !== "players")
                        assetLoader.label.labelsCount[item] = 0;
                });
                for (let filename in assetLoader.asset.filesDetails) {
                    assetLoader.asset.filesDetails[filename].labels.forEach(function (item) {
                        assetLoader.label.labelsCount[item] = (assetLoader.label.labelsCount[item] || 0) + 1;
                    });
                }
            },

            selectLabel: function(label) {
                assetLoader.label.selectedLabel = label;
                notifyObservers();
            },
            selectPlayerLabel: function(label) {
                assetLoader.label.selectedPlayerLabel = label;
                notifyObservers();
            },
            selectPlaylist: function(playlist) {
                assetLoader.playlist.selectedPlaylist = playlist;
                notifyObservers();
            },
            removeAssetFromPlaylist: function(playlistName, assetIndex) {
                assetLoader.asset.groupWiseAssets[playlistName].playlist.assets.splice(assetIndex,1);
                assetLoader.asset.groupWiseAssets[playlistName].assets.splice(assetIndex,1);
            },
            registerObserverCallback: function(callback,key){
                observerCallbacks[key] = callback;
            }
        };

        loadAllModels();

        return assetLoader;
    });