(function(angular, R) {
    'use strict';

    var HIDE_DIALOG_KEY = 'hideDialog';

    var modules,
        parents;

    function prepareData(data) {
        // Returns only "modules" in the module tree that have children (= categories)
        parents = flatten(R.path(['children', 'length']), data, []);
        // Returns only modules that have no children (= modules)
        modules = flatten(function(curr) {
            return curr.details && curr.details.length;
        }, data, []);
    }

    angular
        .module('informatikModules', ['angularTreeview', 'ngSanitize'])
        .config(function($locationProvider) {
            $locationProvider.html5Mode({
                enabled: true,
                requireBase: false
            });
        })
        .controller('RootCtrl', function($scope, $http, $location, $timeout) {
            var urlParams = $location.search(),
                moduleToOpen = urlParams.module;

            $scope.ALL_EXPANDED = 'ALL_EXPANDED';
            $scope.ALL_COLLAPSED = 'ALL_COLLAPSED';

            $timeout(init, 0);

            $scope.config = {
                // object to string conversion/troll by localStorage
                showDialog: getFromLocalStorage(HIDE_DIALOG_KEY) !== 'true'
            };

            function init() {
                // Retrieve module data
                $http
                    .get('assets/modules.json')
                    // prepare data (= get parents and modules)
                    .success(function(data) {
                        prepareData(data);
                        $scope.data = data;
                        $timeout(initTree);
                    })
                    .then($timeout.bind(null, $scope.openModuleFromUrl, 0));
            }

            function initTree() {
                var lastNode;
                $scope.treeSelectNodeLabel = $scope.tree.selectNodeLabel;

                $scope.tree.selectNodeLabel = function(node) {
                    var isSameNode = node === lastNode;
                    $scope.showSelected(node, !isSameNode);
                    $scope.treeSelectNodeLabel(isSameNode ? {} : node);
                    lastNode = isSameNode ? null : node;
                };
            }

            $scope.openModuleFromUrl = function() {
                if (moduleToOpen) {
                    var moduleData = getModuleById(moduleToOpen);
                    $scope.treeSelectNodeLabel(moduleData);
                    $scope.showSelected(moduleData, true);
                    $scope.selected = moduleData;
                }
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
                if ($scope.config.hideOverlayNextTime) {
                    setLocalStorage(HIDE_DIALOG_KEY, true);
                }
            };
        });

    function getFromLocalStorage(key) {
        return localStorage && localStorage.getItem(key);
    }

    function setLocalStorage(key, value_) {
        var value = typeof value_ === 'object' ? JSON.stringify(value_) : value_;
        localStorage.setItem(key, value);
    }

    function getModuleById(moduleId) {
        return R.find(R.propEq('text', moduleId), modules);
    }

    function flatten(test, list, acc) {
        if (!list.length) return acc;

        return R.reduce(function(acc, curr) {
            if (test(curr)) acc.push(curr);
            return curr.children.length ? flatten(test, curr.children, acc) : acc;
        }, acc, list);
    }
})(angular, R);
