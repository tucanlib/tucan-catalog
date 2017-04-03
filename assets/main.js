(function(angular, R, md5) {
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
        data.forEach(walkModules.bind(null, function(module, parent) {
            module.parent = parent;
            var hash = module.title;
            if(parent && parent.title) {
                hash += '_' + parent.title;
            }

            module.hash = md5(hash);

            if (!module.children.length && (!module.details ||  (module.details && !module.details.length))) {
                module.hidden = true;
            }
        }, null));

        data.forEach(addParentReferences);

        var closedParents = getClosedParentsFromLocalStorage() || [];
        R.forEach(function(parent) {
            if (closedParents.indexOf(parent.title) >= 0) {
                parent.collapsed = true;
            }
        }, parents);

        var hiddenCourses = getHiddenCoursesFromLocalStorage() || [];
        R.forEach(function(module) {
            if (hiddenCourses.indexOf(module.title) >= 0) {
                module.hidden = true;
            }
        }, modules);
    }

    angular
        .module('informatikModules', ['angularTreeview', 'ngSanitize', 'informatikModulesConstants'])
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
        .controller('RootCtrl', function($scope, $http, $location, $timeout, $window, SEMESTER, LAST_UPDATED) {
            var urlParams = $location.search(),
                moduleToOpen = unsanitizeModuleID(urlParams.module);

            // ....
            document.onkeydown = function(evt) {
                var ESC_KEY = 27;
                var H_KEY = 72;
                var J_KEY = 74;

                var hotkeyMap = {};
                hotkeyMap[ESC_KEY] = function() {
                    $scope.showSelected(null, false);
                    $scope.config.showHiddenCoursesDialog = false;
                    $scope.config.showDialog = false;
                };

                hotkeyMap[H_KEY] = function() {
                    toggleModuleNamePreAndSuffixes($scope.data);
                };

                hotkeyMap[J_KEY] = function() {
                    $scope.toggleNodeHiddenStatus($scope.selectedNode, true);
                    $scope.showSelected();
                };

                var action = hotkeyMap[evt.keyCode];
                if (action) {
                    $scope.$apply(action);
                }
            };

            $scope.ALL_EXPANDED = 'ALL_EXPANDED';
            $scope.ALL_COLLAPSED = 'ALL_COLLAPSED';
            $scope.semester = SEMESTER;
            $scope.last_updated = LAST_UPDATED;

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
                            return !!node.hidden;
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

            $scope.clearStorage = function() {
                if('localStorage' in $window) {
                    localStorage.clear();
                    init();
                }
            };

            $scope.getParents = function(module, withCurrent) {
                
                var parents = [];
                if(withCurrent) {
                    parents.push(module.label);
                }
                module = module.parent;
                while(module.parent) {
                    parents.push(module.label);
                    module = module.parent;
                }
                parents.push(module.title);
                return parents.reverse().join(' // ');
            };

            $scope.toggleTitleLengths = function() {
                toggleModuleNamePreAndSuffixes($scope.data);
            };

            $scope.openModuleFromUrl = function() {
                if (moduleToOpen) {
                    var moduleData = getModuleByHash(moduleToOpen);
                    if(!moduleData) {
                        return;
                    }
                    //var moduleData = getModuleById(moduleToOpen);
                    $scope.treeSelectNodeLabel(moduleData);
                    $scope.showSelected(moduleData, true);
                    $scope.selected = moduleData;
                }
            };

            $scope.showSelected = function(node, selected) {
                $scope.selectedNode = selected && node;
                $location.search('module', (selected && node) ? node.hash : '');
                //$location.search('module', (selected && node) ? sanitizeModuleID(node.title) : '');
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

            $scope.toggleNodeHiddenStatus = function(node, hidden) {
                if (hidden === undefined) {
                    hidden = !node.hidden;
                }

                if (!node) return;

                node.hidden = hidden;
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
        })
        //  @see http://codepen.io/anon/pen/LWNNKY
        .directive('resizable', function() {
            var toCall;

            function throttle(fun) {
                if (toCall === undefined) {
                    toCall = fun;
                    setTimeout(function() {
                        toCall();
                        toCall = undefined;
                    }, 100);
                } else {
                    toCall = fun;
                }
            }
            return {
                restrict: 'AE',
                scope: {
                    rDirections: '=',
                    rCenteredX: '=',
                    rCenteredY: '=',
                    rWidth: '=',
                    rHeight: '=',
                    rFlex: '=',
                    rGrabber: '@',
                    rDisabled: '@'
                },
                link: function(scope, element, attr) {
                    var flexBasis = 'flexBasis' in document.documentElement.style ? 'flexBasis' :
                        'webkitFlexBasis' in document.documentElement.style ? 'webkitFlexBasis' :
                        'msFlexPreferredSize' in document.documentElement.style ? 'msFlexPreferredSize' : 'flexBasis';

                    // register watchers on width and height attributes if they are set
                    scope.$watch('rWidth', function(value) {
                        element[0].style.width = scope.rWidth + 'px';
                    });
                    scope.$watch('rHeight', function(value) {
                        element[0].style.height = scope.rHeight + 'px';
                    });

                    element.addClass('resizable');

                    var style = window.getComputedStyle(element[0], null),
                        w,
                        h,
                        dir = scope.rDirections,
                        vx = scope.rCenteredX ? 2 : 1, // if centered double velocity
                        vy = scope.rCenteredY ? 2 : 1, // if centered double velocity
                        inner = scope.rGrabber ? scope.rGrabber : '<span></span>',
                        start,
                        dragDir,
                        axis,
                        info = {};

                    var updateInfo = function(e) {
                        info.width = false;
                        info.height = false;
                        if (axis === 'x')
                            info.width = parseInt(element[0].style[scope.rFlex ? flexBasis : 'width']);
                        else
                            info.height = parseInt(element[0].style[scope.rFlex ? flexBasis : 'height']);
                        info.id = element[0].id;
                        info.evt = e;
                    };

                    var dragging = function(e) {
                        var prop, offset = axis === 'x' ? start - e.clientX : start - e.clientY;
                        switch (dragDir) {
                            case 'top':
                                prop = scope.rFlex ? flexBasis : 'height';
                                element[0].style[prop] = h + (offset * vy) + 'px';
                                break;
                            case 'bottom':
                                prop = scope.rFlex ? flexBasis : 'height';
                                element[0].style[prop] = h - (offset * vy) + 'px';
                                break;
                            case 'right':
                                prop = scope.rFlex ? flexBasis : 'width';
                                element[0].style[prop] = w - (offset * vx) + 'px';
                                break;
                            case 'left':
                                prop = scope.rFlex ? flexBasis : 'width';
                                element[0].style[prop] = w + (offset * vx) + 'px';
                                break;
                        }
                        updateInfo(e);
                        throttle(function() { scope.$emit('angular-resizable.resizing', info); });
                    };
                    var dragEnd = function(e) {
                        updateInfo();
                        scope.$emit('angular-resizable.resizeEnd', info);
                        scope.$apply();
                        document.removeEventListener('mouseup', dragEnd, false);
                        document.removeEventListener('mousemove', dragging, false);
                        element.removeClass('no-transition');
                    };
                    var dragStart = function(e, direction) {
                        dragDir = direction;
                        axis = dragDir === 'left' || dragDir === 'right' ? 'x' : 'y';
                        start = axis === 'x' ? e.clientX : e.clientY;
                        w = parseInt(style.getPropertyValue('width'));
                        h = parseInt(style.getPropertyValue('height'));

                        //prevent transition while dragging
                        element.addClass('no-transition');

                        document.addEventListener('mouseup', dragEnd, false);
                        document.addEventListener('mousemove', dragging, false);

                        // Disable highlighting while dragging
                        if (e.stopPropagation) e.stopPropagation();
                        if (e.preventDefault) e.preventDefault();
                        e.cancelBubble = true;
                        e.returnValue = false;

                        updateInfo(e);
                        scope.$emit('angular-resizable.resizeStart', info);
                        scope.$apply();
                    };

                    dir.forEach(function(direction) {
                        var grabber = document.createElement('div');

                        // add class for styling purposes
                        grabber.setAttribute('class', 'rg-' + direction);
                        grabber.innerHTML = inner;
                        element[0].appendChild(grabber);
                        grabber.ondragstart = function() {
                            return false; };
                        grabber.addEventListener('mousedown', function(e) {
                            var disabled = (scope.rDisabled === 'true');
                            if (!disabled && e.which === 1) {
                                // left mouse click
                                dragStart(e, direction);
                            }
                        }, false);
                    });
                }
            };
        });;

    function getClosedParentsFromLocalStorage() {
        return getObjectFromLocalStorage('closedParents');
    }

    function getClosedParents() {
        return R.map(R.prop('title'), R.filter(R.prop('collapsed'), parents));
    }

    function getHiddenCoursesFromLocalStorage() {
        return getObjectFromLocalStorage('hiddenCourses');
    }

    function saveHiddenStatus() {
        setLocalStorage('hiddenCourses', R.map(R.prop('title'), R.filter(R.prop('hidden'), modules)));
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
        return getModuleBy('title', moduleId);
    }

    function getModuleByHash(moduleHash) {
        return getModuleBy('hash', moduleHash);
    }

    function getModuleBy(attr, target) {
        return R.find(R.propEq(attr, target), modules);
    }

    function addParentReferences(module) {
        if (module.children && module.children.length)
            module.children.forEach(function(m) {
                m.parent = module;
                addParentReferences(m);
            });
    }

    function walkModules(fn, parent, module) {
        fn(module, parent);
        if (module.children && module.children.length)
            module.children.forEach(walkModules.bind(null, fn, module));
    }

    function toggleModuleNamePreAndSuffixes(modules) {
        var prefixReg = /\d{2}-.{2}-\d{4} /;
        var suffixReg = / \(.+\)$/;

        function cleanName(name) {
            return name.replace(prefixReg, '').replace(suffixReg, '').trim();
        }

        modules.forEach(walkModules.bind(null, function(module) {
            if (!module.oldText) {
                module.label = module.title;
                module.oldText = module.title;
                module.cleanText = cleanName(module.title);
            }

            var currentlyActive = module.oldText === module.label;
            module.label = currentlyActive ? module.cleanText : module.oldText;
        }, null));
    }

    function sanitizeModuleID(id) {
        return id.replace(/\(/g, '//').replace(/\)/g, '\\\\');
    }

    function unsanitizeModuleID(id) {
        return id ? id.replace('//', '(').replace('\\\\', ')') : undefined;
    }

    function flatten(test, list, acc) {
        if (!list.length) return acc;

        return R.reduce(function(acc, curr) {
            if (test(curr)) acc.push(curr);
            return curr.children.length ? flatten(test, curr.children, acc) : acc;
        }, acc, list);
    }
})(angular, R, md5);
