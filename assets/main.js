(function(angular, R) {
    'use strict';

    var HIDE_DIALOG_KEY = 'hideDialog';

    var modules,
        parents;

    function prepareData(data) {
        // Returns only "modules" in the module tree that have children (= categories)
        parents = R.partial(flatten, R.path(['children', 'length']))(data, []);
        // Returns only modules that have no children (= modules)
        modules = R.partial(flatten, function(curr) {
            return curr.details && curr.details.length;
        })(data, []);
    }

    angular
        .module('informatikModules', ['treeControl', 'ngSanitize'])
        .config(function($locationProvider) {
            $locationProvider.html5Mode(true);
        })
        .controller('RootCtrl', function($scope, $http, $location) {
            var urlParams = $location.search(),
                moduleToOpen = urlParams.module;
            $scope.ALL_EXPANDED = 'ALL_EXPANDED';
            $scope.ALL_COLLAPSED = 'ALL_COLLAPSED';

            $scope.config = {
                // object to string conversion/troll by localStorage
                showDialog: getFromLocalStorage(HIDE_DIALOG_KEY) !== 'true'
            };

            $scope.treeOptions = {
                dirSelectable: false,
                level: 20,
                // needed because there are nodes that have the same properties but are different
                equality: function(n1, n2) {
                    return n1 === n2;
                }
            };

            init();

            function init() {
                // Retrieve module data
                $http
                    .get('assets/modules.json')
                    .success(function(data) {
                        $scope.data = data;
                    })
                    // prepare data (= get parents and modules)
                    // open all items in the tree
                    .then(function() {
                        prepareData($scope.data);
                        $scope.toggleExpanded($scope.ALL_EXPANDED);
                    })
                    // If there is a module given in the url params (?module=....) open the corresponding module
                    .then(function() {
                        if(moduleToOpen) {
                            var moduleData = getModuleById(moduleToOpen);
                            $scope.showSelected(moduleData, true);
                            $scope.selected = moduleData;
                        }
                    });
            }

            $scope.toggleExpanded = function(state) {
                $scope.expandedNodes = (state === $scope.ALL_EXPANDED) ? parents : [];
            };

            $scope.showSelected = function(node, selected) {
                $scope.selectedNode = selected && node;
                $location.search('module', (selected && node) ? node.text : '');
            };

            $scope.toggleAside = function() {
                $scope.bigAside = !$scope.bigAside;
            };

            $scope.hideOverlay = function() {
                $scope.config.showDialog = false;
                if($scope.config.hideOverlayNextTime) {
                    setLocalStorage(HIDE_DIALOG_KEY, true);
                }
            };

            function getModuleById(moduleId) {
                return R.find(R.propEq('text', moduleId), modules);
            }
        });

    function getFromLocalStorage(key) {
        return localStorage && localStorage.getItem(key);
    }

    function setLocalStorage(key, value_) {
        var value = typeof value_ === 'object' ? JSON.stringify(value_) : value_;
        localStorage.setItem(key, value);
    }

    function flatten(test, list, acc) {
        if (!list.length) return acc;

        return R.reduce(function(acc, curr) {
            if (test(curr)) acc.push(curr);
            return curr.children.length ? flatten(test, curr.children, acc) : acc;
        }, acc, list);
    }
})(angular, R);
