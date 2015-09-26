(function(angular, R) {
    'use strict';

    function flatten(test, list, acc) {
        return R.reduce(function(acc, curr) {
            if (test(curr)) acc.push(curr);
            return flatten(test, curr.children, acc);
        }, acc, list);
    }

    var getParents = R.partial(flatten, function(curr) {
        return curr.children.length;
    });

    var getModules = R.partial(flatten, function(curr) {
        return curr.details && curr.details.length;
    });

    function prepareData(data) {
        function extractCP(data) {
            return R.trim(R.head(data.split(' ')));
        }

        var modules = getModules(data, []);
        R.forEach(function(module) {
            var CP = R.find(function(item) {
                return item.title.indexOf('Credits') >= 0;
            }, module.details);

            if (CP) {
                module.credits = extractCP(CP.details);
            }
        }, modules);
    }

    angular
        .module('informatikModules', ['treeControl', 'ngSanitize'])
        .controller('RootCtrl', function($scope, $http) {
            $scope.ALL_EXPANDED = 'ALL_EXPANDED';
            $scope.ALL_COLLAPSED = 'ALL_COLLAPSED';

            $scope.treeOptions = {
                nodeChildren: 'children',
                dirSelectable: false,
                level: 20
            };

            $scope.toggleExpanded = function(state) {
                $scope.expandedNodes = state === $scope.ALL_EXPANDED ? getParents($scope.data, []) : [];
            };

            $scope.showSelected = function(node) {
                $scope.selectedNode = node;
            };

            $scope.toggleAside = function() {
                $scope.bigAside = !$scope.bigAside;
            };

            $scope.hideOverlay = function() {
                $scope.overlayHidden = true;
            };

            $http
                .get('assets/modules.json')
                .success(function(data) {
                    prepareData(data);
                    $scope.data = data;
                    $scope.toggleExpanded($scope.ALL_EXPANDED);
                });
        });
})(angular, R);
