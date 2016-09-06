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

        // Hide all empty and non-details modules
        data.forEach(walkModules.bind(null, function(module) {
            if (!module.children.length && (!module.details ||  (module.details && !module.details.length))) {
                module.hidden = true;
            }
        }));

        var closedParents = getClosedParentsFromLocalStorage() || [];
        R.forEach(function(parent) {
            if (closedParents.indexOf(parent.text) >= 0) {
                parent.collapsed = true;
            }
        }, parents);

        var hiddenCourses = getHiddenCoursesFromLocalStorage() || [];
        R.forEach(function(module) {
            if (hiddenCourses.indexOf(module.text) >= 0) {
                module.hidden = true;
            }
        }, modules);
    }

    angular
        .module('informatikModules', ['angularTreeview', 'ngSanitize'])
        .config(function($locationProvider) {
            $locationProvider.html5Mode({
                enabled: true,
                requireBase: false
            });
        })
        .directive('scrollTopOnChange', function() {
            return {
                scope: {
                    scrollTopOnChange: '='
                },
                link: function($scope, element, attrs, controller) {
                    $scope.$watch('scrollTopOnChange', function(newVal, oldVal) {
                        element[0].scrollTop = 0;
                    });
                }
            };
        })
        .controller('RootCtrl', function($scope, $http, $location, $timeout) {
            var urlParams = $location.search(),
                moduleToOpen = urlParams.module;

            // ....
            document.onkeydown = function(evt) {
                var ESC_KEY = 27;
                var H_KEY = 72;

                var hotkeyMap = {};
                hotkeyMap[ESC_KEY] = function() {
                    $scope.showSelected(null, false);
                };

                hotkeyMap[H_KEY] = function() {
                    toggleModuleNamePreAndSuffixes($scope.data);
                };

                var action = hotkeyMap[evt.keyCode];
                if (action) {
                    $scope.$apply(action);
                }
            };
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
                        $scope.toggleTitleLengths();
                        $timeout(initTree);
                    })
                    .then($timeout.bind(null, $scope.openModuleFromUrl, 0));
            }

            function initTree() {
                var lastNode;
                $scope.labelForNode = function(node) {
                    if (node.children && node.children.length) {
                        var filteredLength = node.children.filter(function(node) {
                            return node.hidden;
                        }).length;
                        if (filteredLength > 0) return '(Hidden: %)'.replace('%', filteredLength);
                    }
                };
                $scope.treeSelectNodeLabel = $scope.tree.selectNodeLabel;
                $scope.tree.selectNodeLabel = function(node) {
                    var isSameNode = node === lastNode;
                    $scope.showSelected(node, !isSameNode);
                    $scope.treeSelectNodeLabel(isSameNode ? {} : node);
                    lastNode = isSameNode ? null : node;
                };

                $scope.treeSelectNodeHead = $scope.tree.selectNodeHead;
                $scope.tree.selectNodeHead = function(node) {
                    $scope.treeSelectNodeHead(node);
                    saveCollapsedStatus();
                };
            }

            $scope.toggleTitleLengths = function() {
                toggleModuleNamePreAndSuffixes($scope.data);
            };

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

            $scope.toggleExpanded = function(state) {
                var collapsed = state === $scope.ALL_COLLAPSED;
                R.forEach(function(parent) {
                    parent.collapsed = collapsed;
                }, parents);
                saveCollapsedStatus();
            };

            $scope.hideNode = function(node) {
                node.hidden = true;
                saveHiddenStatus();
            };

            $scope.showAllCourses = function() {
                R.forEach(function(module) {
                    module.hidden = false;
                }, modules);
                saveHiddenStatus();
            };

            $scope.hiddenCourses = function() {
                return modules ? R.filter(R.prop('hidden'), modules) : 0;
            };
        });

    function getClosedParentsFromLocalStorage() {
        return getObjectFromLocalStorage('closedParents');
    }

    function getClosedParents() {
        return R.map(R.prop('text'), R.filter(R.prop('collapsed'), parents));
    }

    function getHiddenCoursesFromLocalStorage() {
        return getObjectFromLocalStorage('hiddenCourses');
    }

    function saveHiddenStatus() {
        setLocalStorage('hiddenCourses', R.map(R.prop('text'), R.filter(R.prop('hidden'), modules)));
    }

    function saveCollapsedStatus() {
        setLocalStorage('closedParents', getClosedParents());
    }

    function getObjectFromLocalStorage(key) {
        return JSON.parse(getFromLocalStorage(key));
    }

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

    function walkModules(fn, module) {
        fn(module);
        if (module.children && module.children.length)
            module.children.forEach(walkModules.bind(null, fn));
    }

    function toggleModuleNamePreAndSuffixes(modules) {
        var prefixReg = /\d{2}-.{2}-\d{4} /;
        var suffixReg = / \(.+\)$/;

        function cleanName(name) {
            return name.replace(prefixReg, '').replace(suffixReg, '').trim();
        }

        modules.forEach(walkModules.bind(null, function(module) {
            if(!module.oldText) {
                module.label = module.text;
                module.oldText = module.text;
                module.cleanText = cleanName(module.text);
            }

            var currentlyActive = module.oldText === module.label;
            if(currentlyActive) {
                module.label = module.cleanText;
            } else {
                module.label = module.oldText;
            }
        }));
    }

    function flatten(test, list, acc) {
        if (!list.length) return acc;

        return R.reduce(function(acc, curr) {
            if (test(curr)) acc.push(curr);
            return curr.children.length ? flatten(test, curr.children, acc) : acc;
        }, acc, list);
    }
})(angular, R);
