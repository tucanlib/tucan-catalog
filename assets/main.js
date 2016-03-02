(function(angular, R) {
    'use strict';

    var getParents = R.partial(flatten, R.path(['children', 'length']));
    var getModules = R.partial(flatten, function(curr) {
        return curr.details && curr.details.length;
    });

    var modules,
        parents;

    function prepareData(data) {
        function extractCP(data) {
            return parseInt(R.trim(R.head(data.split(' '))), 10);
        }

        parents = getParents(data, []);
        modules = getModules(data, []);

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
                dirSelectable: false,
                level: 20,
                equality: function(n1, n2) {
                    return n1 === n2;
                }
            };

            $scope.toggleExpanded = function(state) {
                $scope.expandedNodes = (state === $scope.ALL_EXPANDED) ? parents : [];
            };

            $scope.showSelected = function(node, selected) {
                $scope.selectedNode = selected && node;
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

    function flatten(test, list, acc) {
        if (!list.length) return acc;

        return R.reduce(function(acc, curr) {
            if (test(curr)) acc.push(curr);
            return curr.children.length ? flatten(test, curr.children, acc) : acc;
        }, acc, list);
    }
})(angular, R);
