(function(angular, R) {
    'use strict';

    var modules,
        parents;

    function prepareData(data) {
        // Returns only "modules" in the module tree that have children (= categories)
        parents = R.partial(flatten, R.path(['children', 'length']))(data, []);
        // Returns only modules that have no children (= are modules)
        modules = R.partial(flatten, function(curr) {
            return curr.details && curr.details.length;
        })(data, []);
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

            // Retrieve module data
            $http
                .get('assets/modules.json')
                .success(function(data) {
                    prepareData(data);
                    $scope.data = data;
                    $scope.toggleExpanded($scope.ALL_EXPANDED);
                });

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
        });

    function flatten(test, list, acc) {
        if (!list.length) return acc;

        return R.reduce(function(acc, curr) {
            if (test(curr)) acc.push(curr);
            return curr.children.length ? flatten(test, curr.children, acc) : acc;
        }, acc, list);
    }
})(angular, R);
