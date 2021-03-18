var easyPeasy = (function (
  exports,
  React,
  _objectSpread,
  redux,
  reduxThunk,
  immer,
  webextRedux,
) {
  'use strict';

  function _interopDefaultLegacy(e) {
    return e && typeof e === 'object' && 'default' in e ? e : { default: e };
  }

  var React__default = /*#__PURE__*/ _interopDefaultLegacy(React);
  var _objectSpread__default = /*#__PURE__*/ _interopDefaultLegacy(
    _objectSpread,
  );
  var reduxThunk__default = /*#__PURE__*/ _interopDefaultLegacy(reduxThunk);

  var StoreContext = React.createContext();

  // To get around it, we can conditionally useEffect on the server (no-op) and
  // useLayoutEffect in the browser. We need useLayoutEffect to ensure the store
  // subscription callback always has the selector from the latest render commit
  // available, otherwise a store update may happen between render and the effect,
  // which may cause missed updates; we also must ensure the store subscription
  // is created synchronously, otherwise a store update may occur before the
  // subscription is created and an inconsistent state may be observed

  var useIsomorphicLayoutEffect =
    typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;
  function createStoreStateHook(Context) {
    return function useStoreState(mapState, equalityFn) {
      var store = React.useContext(Context);
      var mapStateRef = React.useRef(mapState);
      var stateRef = React.useRef();
      var mountedRef = React.useRef(true);
      var subscriptionMapStateError = React.useRef();

      var _useReducer = React.useReducer(function (s) {
          return s + 1;
        }, 0),
        forceRender = _useReducer[1];

      if (
        subscriptionMapStateError.current ||
        mapStateRef.current !== mapState ||
        stateRef.current === undefined
      ) {
        try {
          stateRef.current = mapState(store.getState());
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            var errorMessage = 'Error in useStoreState: ' + err.message + '.';

            if (subscriptionMapStateError.current) {
              errorMessage +=
                '\nMaybe related to:\n' +
                subscriptionMapStateError.current.stack;
            }

            throw new Error(errorMessage);
          }

          throw subscriptionMapStateError.current || err;
        }
      }

      useIsomorphicLayoutEffect(function () {
        mapStateRef.current = mapState;
        subscriptionMapStateError.current = undefined;
      });
      useIsomorphicLayoutEffect(function () {
        var checkMapState = function checkMapState() {
          try {
            var newState = mapStateRef.current(store.getState());
            var isStateEqual =
              typeof equalityFn === 'function'
                ? equalityFn(stateRef.current, newState)
                : stateRef.current === newState;

            if (isStateEqual) {
              return;
            }

            stateRef.current = newState;
          } catch (err) {
            // see https://github.com/reduxjs/react-redux/issues/1179
            // There is a possibility mapState will fail due to stale state or
            // props, therefore we will just track the error and force our
            // component to update. It should then receive the updated state
            subscriptionMapStateError.current = err;
          }

          if (mountedRef.current) {
            forceRender({});
          }
        };

        var unsubscribe = store.subscribe(checkMapState);
        checkMapState();
        return function () {
          mountedRef.current = false;
          unsubscribe();
        };
      }, []);
      return stateRef.current;
    };
  }
  var useStoreState = createStoreStateHook(StoreContext);
  function createStoreActionsHook(Context) {
    return function useStoreActions(mapActions) {
      var store = React.useContext(Context);
      return mapActions(store.getActions());
    };
  }
  var useStoreActions = createStoreActionsHook(StoreContext);
  function createStoreDispatchHook(Context) {
    return function useStoreDispatch() {
      var store = React.useContext(Context);
      return store.dispatch;
    };
  }
  var useStoreDispatch = createStoreDispatchHook(StoreContext);
  function useStore() {
    return React.useContext(StoreContext);
  }
  function createStoreRehydratedHook(Context) {
    return function useStoreRehydrated() {
      var store = React.useContext(Context);

      var _useState = React.useState(false),
        rehydrated = _useState[0],
        setRehydrated = _useState[1];

      React.useEffect(function () {
        store.persist.resolveRehydration().then(function () {
          return setRehydrated(true);
        });
      }, []);
      return rehydrated;
    };
  }
  var useStoreRehydrated = createStoreRehydratedHook(StoreContext);
  function createTypedHooks() {
    return {
      useStoreActions: useStoreActions,
      useStoreDispatch: useStoreDispatch,
      useStoreState: useStoreState,
      useStoreRehydrated: useStoreRehydrated,
      useStore: useStore,
    };
  }

  var actionSymbol = '$_a';
  var actionOnSymbol = '$_aO';
  var computedSymbol = '$_c';
  var effectOnSymbol = '$_e';
  var persistSymbol = '$_p';
  var reducerSymbol = '$_r';
  var thunkOnSymbol = '$_tO';
  var thunkSymbol = '$_t';
  var aliasSymbol = '$_alias';

  var debug = function debug(state) {
    if (immer.isDraft(state)) {
      return immer.current(state);
    }

    return state;
  };
  var actionOn = function actionOn(targetResolver, fn) {
    var _ref;

    return (
      (_ref = {}),
      (_ref[actionOnSymbol] = true),
      (_ref.fn = fn),
      (_ref.targetResolver = targetResolver),
      _ref
    );
  };
  var action = function action(fn) {
    var _ref2;

    return (_ref2 = {}), (_ref2[actionSymbol] = true), (_ref2.fn = fn), _ref2;
  };
  var defaultStateResolvers = [
    function (state) {
      return state;
    },
  ];
  var computed = function computed(fnOrStateResolvers, fn) {
    var _ref4;

    if (typeof fn === 'function') {
      var _ref3;

      return (
        (_ref3 = {}),
        (_ref3[computedSymbol] = true),
        (_ref3.fn = fn),
        (_ref3.stateResolvers = fnOrStateResolvers),
        _ref3
      );
    }

    return (
      (_ref4 = {}),
      (_ref4[computedSymbol] = true),
      (_ref4.fn = fnOrStateResolvers),
      (_ref4.stateResolvers = defaultStateResolvers),
      _ref4
    );
  };
  function unstable_effectOn(dependencyResolvers, fn) {
    var _ref5;

    return (
      (_ref5 = {}),
      (_ref5[effectOnSymbol] = true),
      (_ref5.dependencyResolvers = dependencyResolvers),
      (_ref5.fn = fn),
      _ref5
    );
  }
  function generic(value) {
    return value;
  }
  var persist = function persist(model, config) {
    var _objectSpread2;

    return (
      // if we are not running in a browser context this becomes a no-op
      typeof window === 'undefined'
        ? model
        : _objectSpread__default['default'](
            _objectSpread__default['default']({}, model),
            {},
            ((_objectSpread2 = {}),
            (_objectSpread2[persistSymbol] = config),
            _objectSpread2),
          )
    );
  };
  var thunkOn = function thunkOn(targetResolver, fn) {
    var _ref6;

    return (
      (_ref6 = {}),
      (_ref6[thunkOnSymbol] = true),
      (_ref6.fn = fn),
      (_ref6.targetResolver = targetResolver),
      _ref6
    );
  };
  var thunk = function thunk(fn) {
    var _ref7;

    return (_ref7 = {}), (_ref7[thunkSymbol] = true), (_ref7.fn = fn), _ref7;
  };
  var alias = function alias(fn) {
    var _ref8;

    return (_ref8 = {}), (_ref8[aliasSymbol] = true), (_ref8.fn = fn), _ref8;
  };
  var reducer = function reducer(fn) {
    var _ref9;

    return (_ref9 = {}), (_ref9[reducerSymbol] = true), (_ref9.fn = fn), _ref9;
  };

  /**
   * We create our own immer instance to avoid potential issues with autoFreeze
   * becoming default enabled everywhere. We want to disable autofreeze as it
   * does not suit the design of Easy Peasy.
   * https://github.com/immerjs/immer/issues/681#issuecomment-705581111
   */

  var easyPeasyImmer;
  function isPlainObject(obj) {
    if (typeof obj !== 'object' || obj === null) return false;
    var proto = obj;

    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }

    return Object.getPrototypeOf(obj) === proto;
  }
  function clone(source) {
    function recursiveClone(current) {
      var next = Object.keys(current).reduce(function (acc, key) {
        if (Object.getOwnPropertyDescriptor(current, key).get == null) {
          acc[key] = current[key];
        }

        return acc;
      }, {});
      Object.keys(next).forEach(function (key) {
        if (isPlainObject(next[key])) {
          next[key] = recursiveClone(next[key]);
        }
      });
      return next;
    }

    return recursiveClone(source);
  }
  function isPromise(x) {
    return x != null && typeof x === 'object' && typeof x.then === 'function';
  }
  function get(path, target) {
    return path.reduce(function (acc, cur) {
      return isPlainObject(acc) ? acc[cur] : undefined;
    }, target);
  }
  function newify(currentPath, currentState, finalValue) {
    if (currentPath.length === 0) {
      return finalValue;
    }

    var newState = _objectSpread__default['default']({}, currentState);

    var key = currentPath[0];

    if (currentPath.length === 1) {
      newState[key] = finalValue;
    } else {
      newState[key] = newify(currentPath.slice(1), newState[key], finalValue);
    }

    return newState;
  }
  function set(path, target, value) {
    if (path.length === 0) {
      if (typeof value === 'object') {
        Object.keys(target).forEach(function (key) {
          delete target[key];
        });
        Object.keys(value).forEach(function (key) {
          target[key] = value[key];
        });
      }

      return;
    }

    path.reduce(function (acc, cur, idx) {
      if (idx + 1 === path.length) {
        acc[cur] = value;
      } else {
        acc[cur] = acc[cur] || {};
      }

      return acc[cur];
    }, target);
  }
  function createSimpleProduce(disableImmer) {
    if (disableImmer === void 0) {
      disableImmer = false;
    }

    return function simpleProduce(path, state, fn) {
      if (disableImmer) {
        var _current = get(path, state);

        var next = fn(_current);

        if (_current !== next) {
          return newify(path, state, next);
        }

        return state;
      }

      if (!easyPeasyImmer) {
        easyPeasyImmer = new immer.Immer({
          // We need to ensure that we disable proxies if they aren't available
          // on the environment. Users need to ensure that they use the enableES5
          // feature of immer.
          useProxies:
            typeof Proxy !== 'undefined' &&
            typeof Proxy.revocable !== 'undefined' &&
            typeof Reflect !== 'undefined',
          // Autofreezing breaks easy-peasy, we need a mixed version of immutability
          // and mutability in order to apply updates to our computed properties
          autoFreeze: false,
        });
      }

      if (path.length === 0) {
        var _draft = easyPeasyImmer.createDraft(state);

        var _result = fn(_draft);

        if (_result) {
          return immer.isDraft(_result)
            ? easyPeasyImmer.finishDraft(_result)
            : _result;
        }

        return easyPeasyImmer.finishDraft(_draft);
      }

      var parentPath = path.slice(0, path.length - 1);
      var draft = easyPeasyImmer.createDraft(state);
      var parent = get(parentPath, state);
      var current = get(path, draft);
      var result = fn(current);

      if (result) {
        parent[path[path.length - 1]] = result;
      }

      return easyPeasyImmer.finishDraft(draft);
    };
  }

  var pReduce = function pReduce(iterable, reducer, initialValue) {
    return new Promise(function (resolve, reject) {
      var iterator = iterable[Symbol.iterator]();
      var index = 0;

      var next = function next(total) {
        var element = iterator.next();

        if (element.done) {
          resolve(total);
          return;
        }

        Promise.all([total, element.value])
          .then(function (value) {
            return (
              // eslint-disable-next-line no-plusplus
              next(reducer(value[0], value[1], index++))
            );
          })
          .catch(function (err) {
            return reject(err);
          });
      };

      next(initialValue);
    });
  };

  var pSeries = function pSeries(tasks) {
    var results = [];
    return pReduce(tasks, function (_, task) {
      return task().then(function (value) {
        results.push(value);
      });
    }).then(function () {
      return results;
    });
  };
  function areInputsEqual(newInputs, lastInputs) {
    if (newInputs.length !== lastInputs.length) {
      return false;
    }

    for (var i = 0; i < newInputs.length; i += 1) {
      if (newInputs[i] !== lastInputs[i]) {
        return false;
      }
    }

    return true;
  } // export function memoizeOne(resultFn) {
  //   let lastArgs = [];
  //   let lastResult;
  //   let calledOnce = false;
  //   return function memoized(...args) {
  //     if (calledOnce && areInputsEqual(args, lastArgs)) {
  //       return lastResult;
  //     }
  //     lastResult = resultFn(...args);
  //     calledOnce = true;
  //     lastArgs = args;
  //     return lastResult;
  //   };
  // }

  function useMemoOne( // getResult changes on every call,
    getResult, // the inputs array changes on every call
    inputs,
  ) {
    // using useState to generate initial value as it is lazy
    var initial = React__default['default'].useState(function () {
      return {
        inputs: inputs,
        result: getResult(),
      };
    })[0];
    var committed = React__default['default'].useRef(initial); // persist any uncommitted changes after they have been committed

    var isInputMatch = Boolean(
      inputs &&
        committed.current.inputs &&
        areInputsEqual(inputs, committed.current.inputs),
    ); // create a new cache if required

    var cache = isInputMatch
      ? committed.current
      : {
          inputs: inputs,
          result: getResult(),
        }; // commit the cache

    React__default['default'].useEffect(
      function () {
        committed.current = cache;
      },
      [cache],
    );
    return cache.result;
  }

  function createReducer(disableImmer, _aRD, _cR, _cP) {
    var simpleProduce = createSimpleProduce(disableImmer);

    var runActionReducerAtPath = function runActionReducerAtPath(
      state,
      action,
      actionReducer,
      path,
    ) {
      return simpleProduce(path, state, function (draft) {
        return actionReducer(draft, action.payload);
      });
    };

    var reducerForActions = function reducerForActions(state, action) {
      var actionReducer = _aRD[action.type];

      if (actionReducer) {
        return runActionReducerAtPath(
          state,
          action,
          actionReducer,
          actionReducer.def.meta.parent,
        );
      }

      return state;
    };

    var reducerForCustomReducers = function reducerForCustomReducers(
      state,
      action,
    ) {
      return _cR.reduce(function (acc, _ref) {
        var parentPath = _ref.parentPath,
          key = _ref.key,
          reducer = _ref.reducer;
        return simpleProduce(parentPath, acc, function (draft) {
          draft[key] = reducer(
            immer.isDraft(draft[key]) ? immer.original(draft[key]) : draft[key],
            action,
          );
          return draft;
        });
      }, state);
    };

    var rootReducer = function rootReducer(state, action) {
      var stateAfterActions = reducerForActions(state, action);
      var next =
        _cR.length > 0
          ? reducerForCustomReducers(stateAfterActions, action)
          : stateAfterActions;

      if (state !== next) {
        _cP.forEach(function (_ref2) {
          var parentPath = _ref2.parentPath,
            bindComputedProperty = _ref2.bindComputedProperty;
          var parentState = get(parentPath, next);
          if (parentState != null) bindComputedProperty(parentState, next);
        });
      }

      return next;
    };

    return rootReducer;
  }

  var noopStorage = {
    getItem: function getItem() {
      return undefined;
    },
    setItem: function setItem() {
      return undefined;
    },
    removeItem: function removeItem() {
      return undefined;
    },
  };

  var getBrowerStorage = function getBrowerStorage(storageName) {
    var storageCache;
    return function () {
      if (!storageCache) {
        try {
          if (
            typeof window !== 'undefined' &&
            typeof window[storageName] !== 'undefined'
          ) {
            storageCache = window[storageName];
          }
        } catch (_) {
          // swallow the failure
        }

        if (!storageCache) {
          storageCache = noopStorage;
        }
      }

      return storageCache;
    };
  };

  var localStorage = getBrowerStorage('localStorage');
  var sessionStorage = getBrowerStorage('sessionStorage');

  function createStorageWrapper(storage, transformers) {
    if (transformers === void 0) {
      transformers = [];
    }

    if (storage == null) {
      storage = sessionStorage();
    }

    if (typeof storage === 'string') {
      if (storage === 'localStorage') {
        storage = localStorage();
      } else if (storage === 'sessionStorage') {
        storage = sessionStorage();
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Invalid storage provider');
        }

        storage = noopStorage;
      }
    }

    var outTransformers = [].concat(transformers).reverse();

    var serialize = function serialize(data) {
      if (transformers.length > 0 && data != null && typeof data === 'object') {
        Object.keys(data).forEach(function (key) {
          data[key] = transformers.reduce(function (acc, cur) {
            return cur.in(acc, key);
          }, data[key]);
        });
      }

      return storage === localStorage() || storage === sessionStorage()
        ? JSON.stringify({
            data: data,
          })
        : data;
    };

    var deserialize = function deserialize(data) {
      var result =
        storage === localStorage() || storage === sessionStorage()
          ? JSON.parse(data).data
          : data;

      if (
        outTransformers.length > 0 &&
        result != null &&
        typeof result === 'object'
      ) {
        Object.keys(result).forEach(function (key) {
          result[key] = outTransformers.reduce(function (acc, cur) {
            return cur.out(acc, key);
          }, result[key]);
        });
      }

      return result;
    };

    var isAsync = isPromise(storage.getItem('_'));
    return {
      getItem: function getItem(key) {
        if (isAsync) {
          return storage.getItem(key).then(function (wrapped) {
            return wrapped != null ? deserialize(wrapped) : undefined;
          });
        }

        var wrapped = storage.getItem(key);
        return wrapped != null ? deserialize(wrapped) : undefined;
      },
      setItem: function setItem(key, data) {
        return storage.setItem(key, serialize(data));
      },
      removeItem: function removeItem(key) {
        return storage.removeItem(key);
      },
    };
  }

  function extractPersistConfig(path, persistdef) {
    if (persistdef === void 0) {
      persistdef = {};
    }

    return {
      path: path,
      config: {
        allow: persistdef.allow || [],
        deny: persistdef.deny || [],
        mergeStrategy: persistdef.mergeStrategy || 'mergeDeep',
        storage: createStorageWrapper(
          persistdef.storage,
          persistdef.transformers,
        ),
      },
    };
  }

  function resolvePersistTargets(target, allow, deny) {
    var targets = Object.keys(target);

    if (allow.length > 0) {
      targets = targets.reduce(function (acc, cur) {
        if (
          allow.findIndex(function (x) {
            return x === cur;
          }) !== -1
        ) {
          return [].concat(acc, [cur]);
        }

        return acc;
      }, []);
    }

    if (deny.length > 0) {
      targets = targets.reduce(function (acc, cur) {
        if (
          deny.findIndex(function (x) {
            return x === cur;
          }) !== -1
        ) {
          return acc;
        }

        return [].concat(acc, [cur]);
      }, []);
    }

    return targets;
  }

  function createPersistenceClearer(persistKey, _r) {
    return function () {
      if (_r._i._persistenceConfig.length === 0) {
        return Promise.resolve();
      }

      return pSeries(
        _r._i._persistenceConfig.map(function (_ref) {
          var path = _ref.path,
            config = _ref.config;
          return function () {
            return Promise.resolve(config.storage.removeItem(persistKey(path)));
          };
        }),
      );
    };
  }

  function createPersistor(persistKey, _r) {
    var persistPromise = Promise.resolve();
    var isPersisting = false;
    var nextPersistOperation;
    var timingMethod =
      typeof window === 'undefined'
        ? function (fn) {
            return fn();
          }
        : window.requestIdleCallback != null
        ? window.requestIdleCallback
        : window.requestAnimationFrame;

    var persist = function persist(nextState) {
      if (_r._i._persistenceConfig.length === 0) {
        return;
      }

      var operation = function operation() {
        isPersisting = true;
        persistPromise = new Promise(function (resolve) {
          timingMethod(function () {
            pSeries(
              _r._i._persistenceConfig.map(function (_ref2) {
                var path = _ref2.path,
                  config = _ref2.config;
                return function () {
                  var storage = config.storage,
                    allow = config.allow,
                    deny = config.deny;
                  var persistRootState = clone(get(path, nextState));
                  var persistTargets = resolvePersistTargets(
                    persistRootState,
                    allow,
                    deny,
                  );
                  var stateToPersist = {};
                  persistTargets.map(function (key) {
                    var targetPath = [].concat(path, [key]);
                    var rawValue = get(targetPath, nextState);
                    var value = isPlainObject(rawValue)
                      ? clone(rawValue)
                      : rawValue;
                    stateToPersist[key] = value;
                  });
                  return Promise.resolve(
                    storage.setItem(persistKey(path), stateToPersist),
                  );
                };
              }),
            ).finally(function () {
              isPersisting = false;

              if (nextPersistOperation) {
                var next = nextPersistOperation;
                nextPersistOperation = null;
                next();
              } else {
                resolve();
              }
            });
          });
        });
      };

      if (isPersisting) {
        nextPersistOperation = operation;
      } else {
        operation();
      }
    };

    return {
      persist: persist,
      clear: createPersistenceClearer(persistKey, _r),
      flush: function flush() {
        if (nextPersistOperation) {
          nextPersistOperation();
        }

        return persistPromise;
      },
    };
  }
  function createPersistMiddleware(persistor, _r) {
    return function (_ref3) {
      var getState = _ref3.getState;
      return function (next) {
        return function (action) {
          var state = next(action);

          if (
            action &&
            action.type !== '@action.ePRS' &&
            _r._i._persistenceConfig.length > 0
          ) {
            persistor.persist(getState());
          }

          return state;
        };
      };
    };
  }
  function rehydrateStateFromPersistIfNeeded(
    persistKey,
    replaceState,
    _r,
    root,
  ) {
    if (_r._i._persistenceConfig.length === 0) {
      return Promise.resolve();
    }

    var state = clone(_r._i._dS);
    var rehydrating = false;
    return pSeries(
      _r._i._persistenceConfig.map(function (persistInstance) {
        return function () {
          var path = persistInstance.path,
            config = persistInstance.config;
          var mergeStrategy = config.mergeStrategy,
            storage = config.storage;

          if (root && (path.length < 1 || path[0] !== root)) {
            return Promise.resolve();
          }

          var hasDataModelChanged = function hasDataModelChanged(
            dataModel,
            rehydratingModelData,
          ) {
            return (
              dataModel != null &&
              rehydratingModelData != null &&
              (typeof dataModel !== typeof rehydratingModelData ||
                (Array.isArray(dataModel) &&
                  !Array.isArray(rehydratingModelData)))
            );
          };

          var applyRehydrationStrategy = function applyRehydrationStrategy(
            persistedState,
          ) {
            if (mergeStrategy === 'overwrite') {
              set(path, state, persistedState);
            } else if (mergeStrategy === 'mergeShallow') {
              var targetState = get(path, state);
              Object.keys(persistedState).forEach(function (key) {
                if (hasDataModelChanged(targetState[key], persistedState[key]));
                else {
                  targetState[key] = persistedState[key];
                }
              });
            } else if (mergeStrategy === 'mergeDeep') {
              var _targetState = get(path, state);

              var setAt = function setAt(
                currentTargetState,
                currentPersistedState,
              ) {
                Object.keys(currentPersistedState).forEach(function (key) {
                  if (
                    hasDataModelChanged(
                      currentTargetState[key],
                      currentPersistedState[key],
                    )
                  );
                  else if (isPlainObject(currentPersistedState[key])) {
                    currentTargetState[key] = currentTargetState[key] || {};
                    setAt(currentTargetState[key], currentPersistedState[key]);
                  } else {
                    currentTargetState[key] = currentPersistedState[key];
                  }
                });
              };

              setAt(_targetState, persistedState);
            }
          };

          var rehydate = function rehydate(persistedState) {
            if (persistedState != null) {
              applyRehydrationStrategy(persistedState);
              rehydrating = true;
            }
          };

          var getItemResult = storage.getItem(persistKey(path));

          if (isPromise(getItemResult)) {
            return getItemResult.then(rehydate);
          }

          return Promise.resolve(rehydate(getItemResult));
        };
      }),
    ).then(function () {
      if (rehydrating) {
        replaceState(state);
      }
    });
  }

  function createActionCreator(def, _r) {
    function actionCreator(payload) {
      var action = {
        type: def.meta.type,
        payload: payload,
      };

      if (def[actionOnSymbol] && def.meta.resolvedTargets) {
        payload.resolvedTargets = [].concat(def.meta.resolvedTargets);
      }

      return _r.dispatch(action);
    } // We bind the types to the creator for easy reference by consumers

    actionCreator.type = def.meta.type;
    return actionCreator;
  }

  function createThunkHandler(def, _r, injections, _aC) {
    return function (payload, fail) {
      var helpers = {
        dispatch: _r.dispatch,
        fail: fail,
        getState: function getState() {
          return get(def.meta.parent, _r.getState());
        },
        getStoreActions: function getStoreActions() {
          return _aC;
        },
        getStoreState: _r.getState,
        injections: injections,
        meta: {
          key: def.meta.actionName,
          parent: def.meta.parent,
          path: def.meta.path,
        },
      };

      if (def[thunkOnSymbol] && def.meta.resolvedTargets) {
        payload.resolvedTargets = [].concat(def.meta.resolvedTargets);
      }

      return def.fn(get(def.meta.parent, _aC), payload, helpers);
    };
  }

  var logThunkEventListenerError$1 = function logThunkEventListenerError(
    type,
    err,
  ) {
    // eslint-disable-next-line no-console
    console.log('Error in ' + type); // eslint-disable-next-line no-console

    console.log(err);
  };

  var handleEventDispatchErrors$2 = function handleEventDispatchErrors(
    type,
    dispatcher,
  ) {
    return function () {
      try {
        var result = dispatcher.apply(void 0, arguments);

        if (isPromise(result)) {
          result.catch(function (err) {
            logThunkEventListenerError$1(type, err);
          });
        }
      } catch (err) {
        logThunkEventListenerError$1(type, err);
      }
    };
  };

  function createThunkActionsCreator(def, _r) {
    var actionCreator = function actionCreator(payload) {
      var dispatchStart = handleEventDispatchErrors$2(
        def.meta.startType,
        function () {
          return _r.dispatch({
            type: def.meta.startType,
            payload: payload,
          });
        },
      );
      var dispatchFail = handleEventDispatchErrors$2(
        def.meta.failType,
        function (err) {
          return _r.dispatch({
            type: def.meta.failType,
            payload: payload,
            error: err,
          });
        },
      );
      var dispatchSuccess = handleEventDispatchErrors$2(
        def.meta.successType,
        function (result) {
          return _r.dispatch({
            type: def.meta.successType,
            payload: payload,
            result: result,
          });
        },
      );
      dispatchStart();
      var failure = null;

      var fail = function fail(_failure) {
        failure = _failure;
      };

      var result = _r.dispatch(function () {
        return def.thunkHandler(payload, fail);
      });

      if (isPromise(result)) {
        return result.then(function (resolved) {
          if (failure) {
            dispatchFail(failure);
          } else {
            dispatchSuccess(resolved);
          }

          return resolved;
        });
      }

      if (failure) {
        dispatchFail(failure);
      } else {
        dispatchSuccess(result);
      }

      return result;
    };

    actionCreator.type = def.meta.type;
    actionCreator.successType = def.meta.successType;
    actionCreator.failType = def.meta.failType;
    actionCreator.startType = def.meta.startType;
    return actionCreator;
  }

  var logThunkEventListenerError = function logThunkEventListenerError(
    type,
    err,
  ) {
    // eslint-disable-next-line no-console
    console.log('Error in ' + type); // eslint-disable-next-line no-console

    console.log(err);
  };

  var handleEventDispatchErrors$1 = function handleEventDispatchErrors(
    type,
    dispatcher,
  ) {
    return function () {
      try {
        var result = dispatcher.apply(void 0, arguments);

        if (isPromise(result)) {
          result.catch(function (err) {
            logThunkEventListenerError(type, err);
          });
        }
      } catch (err) {
        logThunkEventListenerError(type, err);
      }
    };
  };

  function createAliasActionsCreator(def, _r) {
    var actionCreator = function actionCreator(payload) {
      var dispatchStart = handleEventDispatchErrors$1(
        def.meta.startType,
        function () {
          return _r.dispatch({
            type: def.meta.startType,
            payload: payload,
          });
        },
      );
      handleEventDispatchErrors$1(def.meta.failType, function (err) {
        return _r.dispatch({
          type: def.meta.failType,
          payload: payload,
          error: err,
        });
      });
      var dispatchSuccess = handleEventDispatchErrors$1(
        def.meta.successType,
        function (result) {
          return _r.dispatch({
            type: def.meta.successType,
            payload: payload,
            result: result,
          });
        },
      );
      dispatchStart();

      var result = _r.dispatch({
        type: def.meta.type,
        payload: payload || {},
      });

      if (isPromise(result)) {
        return result.then(function (resolved) {
          {
            dispatchSuccess(resolved);
          }

          return resolved;
        });
      }

      {
        dispatchSuccess(result);
      }

      return result;
    };

    actionCreator.type = def.meta.type;
    actionCreator.successType = def.meta.successType;
    actionCreator.failType = def.meta.failType;
    actionCreator.startType = def.meta.startType;
    return actionCreator;
  }

  function createListenerMiddleware(_r) {
    return function () {
      return function (next) {
        return function (action) {
          var result = next(action);

          if (
            action &&
            _r._i._lAM[action.type] &&
            _r._i._lAM[action.type].length > 0
          ) {
            var sourceAction = _r._i._aCD[action.type];

            _r._i._lAM[action.type].forEach(function (actionCreator) {
              actionCreator({
                type: sourceAction ? sourceAction.def.meta.type : action.type,
                payload: action.payload,
                error: action.error,
                result: action.result,
              });
            });
          }

          return result;
        };
      };
    };
  }
  function bindListenerdefs(listenerdefs, _aC, _aCD, _lAM) {
    listenerdefs.forEach(function (def) {
      var targets = def.targetResolver(get(def.meta.parent, _aC), _aC);
      var targetTypes = (Array.isArray(targets) ? targets : [targets]).reduce(
        function (acc, target) {
          if (
            typeof target === 'function' &&
            target.def.meta.type &&
            _aCD[target.def.meta.type]
          ) {
            if (target.def.meta.successType) {
              acc.push(target.def.meta.successType);
            } else {
              acc.push(target.def.meta.type);
            }
          } else if (typeof target === 'string') {
            acc.push(target);
          }

          return acc;
        },
        [],
      );
      def.meta.resolvedTargets = targetTypes;
      targetTypes.forEach(function (targetType) {
        var listenerReg = _lAM[targetType] || [];
        listenerReg.push(_aCD[def.meta.type]);
        _lAM[targetType] = listenerReg;
      });
    });
  }

  function createComputedPropertyBinder(parentPath, key, def, _r) {
    var runOnce = false;
    var prevInputs = [];
    var prevValue;
    return function createComputedProperty(parentState, storeState) {
      Object.defineProperty(parentState, key, {
        configurable: true,
        enumerable: true,
        get: function get() {
          var inputs = def.stateResolvers.map(function (resolver) {
            return resolver(parentState, storeState);
          });

          if (
            runOnce &&
            (areInputsEqual(prevInputs, inputs) ||
              (_r._i._cS.isInReducer &&
                new Error().stack.match(/shallowCopy/gi) !== null))
          ) {
            // We don't want computed properties resolved every time an action
            // is handled by the reducer. They need to remain lazy, only being
            // computed when used by a component or getState call.
            return prevValue;
          }

          prevInputs = inputs;
          prevValue = def.fn.apply(def, inputs);
          runOnce = true;
          return prevValue;
        },
      });
    };
  }
  function createComputedPropertiesMiddleware(_r) {
    return function () {
      return function (next) {
        return function (action) {
          _r._i._cS.isInReducer = true;
          var result = next(action);
          _r._i._cS.isInReducer = false;
          return result;
        };
      };
    };
  }

  function createEffectsMiddleware(_r) {
    return function (store) {
      return function (next) {
        return function (action) {
          if (_r._i._e.length === 0) {
            return next(action);
          }

          var prevState = store.getState();
          var result = next(action);
          var nextState = store.getState();

          _r._i._e.forEach(function (def) {
            var prevLocal = get(def.meta.parent, prevState);
            var nextLocal = get(def.meta.parent, nextState);

            if (prevLocal !== nextLocal) {
              var prevDependencies = def.dependencyResolvers.map(function (
                resolver,
              ) {
                return resolver(prevLocal);
              });
              var nextDependencies = def.dependencyResolvers.map(function (
                resolver,
              ) {
                return resolver(nextLocal);
              });
              var hasChanged = prevDependencies.some(function (
                dependency,
                idx,
              ) {
                return dependency !== nextDependencies[idx];
              });

              if (hasChanged) {
                def.actionCreator(prevDependencies, nextDependencies, action);
              }
            }
          });

          return result;
        };
      };
    };
  }

  var logEffectError = function logEffectError(err) {
    // As users can't get a handle on effects we need to report the error
    // eslint-disable-next-line no-console
    console.log(err);
  };

  function createEffectHandler(def, _r, injections, _aC) {
    var actions = get(def.meta.parent, _aC);
    var dispose;
    return function (change) {
      var helpers = {
        dispatch: _r.dispatch,
        getState: function getState() {
          return get(def.meta.parent, _r.getState());
        },
        getStoreActions: function getStoreActions() {
          return _aC;
        },
        getStoreState: _r.getState,
        injections: injections,
        meta: {
          key: def.meta.actionName,
          parent: def.meta.parent,
          path: def.meta.path,
        },
      };

      if (dispose !== undefined) {
        var disposeResult = dispose();
        dispose = undefined;

        if (isPromise(disposeResult)) {
          disposeResult.catch(logEffectError);
        }
      }

      var effectResult = def.fn(actions, change, helpers);

      if (isPromise(effectResult)) {
        return effectResult.then(function (resolved) {
          if (typeof resolved === 'function') {
            if (process.env.NODE_ENV !== 'production') {
              // Dispose functions are not allowed to be resolved asynchronously.
              // Doing so would provide inconsistent behaviour around their execution.
              // eslint-disable-next-line no-console
              console.warn(
                '[easy-peasy] Effect is asynchronously resolving a dispose fn.',
              );
            }
          }
        });
      }

      if (typeof effectResult === 'function') {
        dispose = effectResult;
      }

      return undefined;
    };
  }

  var logEffectEventListenerError = function logEffectEventListenerError(
    type,
    err,
  ) {
    // eslint-disable-next-line no-console
    console.log('Error in ' + type); // eslint-disable-next-line no-console

    console.log(err);
  };

  var handleEventDispatchErrors = function handleEventDispatchErrors(
    type,
    dispatcher,
  ) {
    return function () {
      try {
        var result = dispatcher.apply(void 0, arguments);

        if (isPromise(result)) {
          result.catch(function (err) {
            logEffectEventListenerError(type, err);
          });
        }
      } catch (err) {
        logEffectEventListenerError(type, err);
      }
    };
  };

  function createEffectActionsCreator(def, _r, effectHandler) {
    var actionCreator = function actionCreator(
      previousDependencies,
      nextDependencies,
      action,
    ) {
      var change = {
        prev: previousDependencies,
        current: nextDependencies,
        action: action,
      };
      var dispatchStart = handleEventDispatchErrors(
        def.meta.startType,
        function () {
          return _r.dispatch({
            type: def.meta.startType,
            change: change,
          });
        },
      );
      var dispatchSuccess = handleEventDispatchErrors(
        def.meta.successType,
        function () {
          return _r.dispatch({
            type: def.meta.successType,
            change: change,
          });
        },
      );
      dispatchStart();

      try {
        var result = _r.dispatch(function () {
          return effectHandler(change);
        });

        if (isPromise(result)) {
          return result.then(function (resolved) {
            dispatchSuccess(resolved);
            return resolved;
          }, logEffectError);
        }

        dispatchSuccess(result);
        return result;
      } catch (err) {
        logEffectError(err);
      }
    };

    actionCreator.type = def.meta.type;
    actionCreator.startType = def.meta.startType;
    actionCreator.successType = def.meta.successType;
    actionCreator.failType = def.meta.failType;
    return actionCreator;
  }

  function extractDataFromModel(
    model,
    initialState,
    injections,
    _r,
    isProxyStore,
  ) {
    var _dS = initialState;
    var _aCD = {};
    var _aC = {};
    var _aRD = {};
    var actionThunks = {};
    var _cP = [];
    var _cR = [];
    var _e = [];
    var _lAC = {};
    var _lAM = {};
    var listenerdefs = [];
    var _persistenceConfig = [];
    var _cS = {
      isInReducer: false,
    };

    var recursiveExtractFromModel = function recursiveExtractFromModel(
      current,
      parentPath,
    ) {
      return Object.keys(current).forEach(function (key) {
        var value = current[key];
        var path = [].concat(parentPath, [key]);
        var meta = {
          parent: parentPath,
          path: path,
          key: key,
        };

        var handleValueAsState = function handleValueAsState() {
          var initialParentRef = get(parentPath, initialState);

          if (initialParentRef && key in initialParentRef) {
            set(path, _dS, initialParentRef[key]);
          } else {
            set(path, _dS, value);
          }
        };

        if (key === persistSymbol) {
          _persistenceConfig.push(extractPersistConfig(parentPath, value));

          return;
        }

        if (value != null && typeof value === 'object') {
          if (value[actionSymbol] || value[actionOnSymbol]) {
            var def = _objectSpread__default['default']({}, value); // Determine the category of the action

            var category = def[actionSymbol] ? '@action' : '@actionOn'; // Establish the meta data describing the action

            def.meta = {
              actionName: meta.key,
              category: category,
              type: category + '.' + meta.path.join('.'),
              parent: meta.parent,
              path: meta.path,
            }; // Create the "action creator" function

            def.actionCreator = createActionCreator(def, _r); // Create a bidirectional relationship of the def/actionCreator

            def.actionCreator.def = def; // Create a bidirectional relationship of the def/reducer

            def.fn.def = def; // Add the action creator to lookup map

            _aCD[def.meta.type] = def.actionCreator; // Add the reducer to lookup map

            _aRD[def.meta.type] = def.fn; // We don't want to expose the internal action to consumers

            if (meta.key !== 'ePRS') {
              // Set the action creator in the "actions" object tree for
              // either the listeners object tree, or the standard actions/thunks
              // object tree
              if (def[actionOnSymbol]) {
                listenerdefs.push(def);
                set(path, _lAC, def.actionCreator);
              } else {
                set(path, _aC, def.actionCreator);
              }
            }
          } else if (
            value[thunkSymbol] ||
            value[thunkOnSymbol] ||
            value[aliasSymbol]
          ) {
            var _def = _objectSpread__default['default']({}, value); // Determine the category of the thunk

            var _category = '@thunk';

            if (_def[thunkOnSymbol]) {
              _category = '@thunkOn';
            } else if (_def[aliasSymbol]) {
              _category = '@alias';
            } // Establish the meta data describing the thunk

            var type = _category + '.' + meta.path.join('.');
            _def.meta = {
              actionName: meta.key,
              parent: meta.parent,
              path: meta.path,
              type: type,
              startType: type + '(start)',
              successType: type + '(success)',
              failType: type + '(fail)',
            }; // Create the function that will handle, i.e. be executed, when
            // the thunk action is created/dispatched

            _def.thunkHandler = createThunkHandler(_def, _r, injections, _aC); // Register the thunk handler

            set(path, actionThunks, _def.thunkHandler); // Create the "action creator" function

            _def.actionCreator = isProxyStore
              ? createAliasActionsCreator(_def, _r)
              : createThunkActionsCreator(_def, _r); // Create a bidirectional relationship of the def/actionCreator

            _def.actionCreator.def = _def; // Register the action creator within the lookup map

            _aCD[_def.meta.type] = _def.actionCreator; // Set the action creator in the "actions" object tree for
            // either the listeners object tree, or the standard actions/thunks
            // object tree

            if (_def[thunkOnSymbol]) {
              listenerdefs.push(_def);
              set(path, _lAC, _def.actionCreator);
            } else {
              set(path, _aC, _def.actionCreator);
            }
          } else if (value[computedSymbol]) {
            var parent = get(parentPath, _dS);
            var bindComputedProperty = createComputedPropertyBinder(
              parentPath,
              key,
              value,
              _r,
            );
            bindComputedProperty(parent, _dS);

            _cP.push({
              key: key,
              parentPath: parentPath,
              bindComputedProperty: bindComputedProperty,
            });
          } else if (value[reducerSymbol]) {
            _cR.push({
              key: key,
              parentPath: parentPath,
              reducer: value.fn,
            });
          } else if (value[effectOnSymbol]) {
            var _def2 = _objectSpread__default['default']({}, value); // Establish the meta data describing the effect

            var _type = '@effectOn.' + meta.path.join('.');

            _def2.meta = {
              type: _type,
              actionName: meta.key,
              parent: meta.parent,
              path: meta.path,
              startType: _type + '(start)',
              successType: _type + '(success)',
              failType: _type + '(fail)',
            };
            var effectHandler = createEffectHandler(_def2, _r, injections, _aC);
            var actionCreator = createEffectActionsCreator(
              _def2,
              _r,
              effectHandler,
            );
            _def2.actionCreator = actionCreator;

            _e.push(_def2);
          } else if (isPlainObject(value)) {
            var existing = get(path, _dS);

            if (existing == null) {
              set(path, _dS, {});
            }

            recursiveExtractFromModel(value, path);
          } else {
            handleValueAsState();
          }
        } else {
          handleValueAsState();
        }
      });
    };

    _persistenceConfig = _persistenceConfig.sort(function (a, b) {
      var aPath = a.path.join('.');
      var bPath = b.path.join('.');

      if (aPath < bPath) {
        return -1;
      }

      if (aPath > bPath) {
        return 1;
      }

      return 0;
    });
    recursiveExtractFromModel(model, []);
    bindListenerdefs(listenerdefs, _aC, _aCD, _lAM);
    return {
      _aCD: _aCD,
      _aC: _aC,
      _aRD: _aRD,
      _cP: _cP,
      _cR: _cR,
      _cS: _cS,
      _dS: _dS,
      _e: _e,
      _lAC: _lAC,
      _lAM: _lAM,
      _persistenceConfig: _persistenceConfig,
    };
  }

  function createStore(model, options) {
    if (options === void 0) {
      options = {};
    }

    var modelClone = clone(model);
    var _options = options,
      compose = _options.compose,
      _options$devTools = _options.devTools,
      devTools =
        _options$devTools === void 0
          ? process.env.NODE_ENV !== 'production'
          : _options$devTools,
      _options$disableImmer = _options.disableImmer,
      disableImmer =
        _options$disableImmer === void 0 ? false : _options$disableImmer,
      _options$enhancers = _options.enhancers,
      enhancers = _options$enhancers === void 0 ? [] : _options$enhancers,
      _options$initialState = _options.initialState,
      initialState =
        _options$initialState === void 0 ? {} : _options$initialState,
      _options$injections = _options.injections,
      injections = _options$injections === void 0 ? {} : _options$injections,
      _options$middleware = _options.middleware,
      middleware = _options$middleware === void 0 ? [] : _options$middleware,
      _options$mockActions = _options.mockActions,
      mockActions =
        _options$mockActions === void 0 ? false : _options$mockActions,
      _options$name = _options.name,
      storeName = _options$name === void 0 ? 'EasyPeasyStore' : _options$name,
      _options$version = _options.version,
      version = _options$version === void 0 ? 0 : _options$version,
      _options$reducerEnhan = _options.reducerEnhancer,
      reducerEnhancer =
        _options$reducerEnhan === void 0
          ? function (rootReducer) {
              return rootReducer;
            }
          : _options$reducerEnhan,
      _options$isProxyStore = _options.isProxyStore,
      isProxyStore =
        _options$isProxyStore === void 0 ? false : _options$isProxyStore,
      _options$proxyStoreOp = _options.proxyStoreOptions,
      proxyStoreOptions =
        _options$proxyStoreOp === void 0 ? {} : _options$proxyStoreOp;

    var bindReplaceState = function bindReplaceState(modelDef) {
      return _objectSpread__default['default'](
        _objectSpread__default['default']({}, modelDef),
        {},
        {
          ePRS: action(function (_, payload) {
            return payload;
          }),
        },
      );
    };

    var _r = {};
    var modeldef = bindReplaceState(modelClone);
    var mockedActions = [];

    var persistKey = function persistKey(targetPath) {
      return (
        '[' +
        storeName +
        '][' +
        version +
        ']' +
        (targetPath.length > 0 ? '[' + targetPath.join('.') + ']' : '')
      );
    };

    var persistor = createPersistor(persistKey, _r);
    var persistMiddleware = createPersistMiddleware(persistor, _r);

    var replaceState = function replaceState(nextState) {
      return _r._i._aCD['@action.ePRS'](nextState);
    };

    var bindStoreInternals = function bindStoreInternals(state) {
      if (state === void 0) {
        state = {};
      }

      var data = extractDataFromModel(
        modeldef,
        state,
        injections,
        _r,
        isProxyStore,
      );
      _r._i = _objectSpread__default['default'](
        _objectSpread__default['default']({}, data),
        {},
        {
          reducer: reducerEnhancer(
            createReducer(disableImmer, data._aRD, data._cR, data._cP),
          ),
        },
      );
    };

    var mockActionsMiddleware = function mockActionsMiddleware() {
      return function () {
        return function (action) {
          if (action != null) {
            mockedActions.push(action);
          }

          return undefined;
        };
      };
    };

    var composeEnhancers =
      compose ||
      (devTools &&
      typeof window !== 'undefined' &&
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
        ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
            name: storeName,
          })
        : redux.compose);
    bindStoreInternals(initialState);
    var easyPeasyMiddleware = [
      createComputedPropertiesMiddleware(_r),
    ].concat(middleware, [
      reduxThunk__default['default'],
      createListenerMiddleware(_r),
      createEffectsMiddleware(_r),
      persistMiddleware,
    ]);

    if (mockActions) {
      easyPeasyMiddleware.push(mockActionsMiddleware);
    }

    var store;

    if (isProxyStore) {
      store = new webextRedux.Store(proxyStoreOptions);
    } else {
      store = redux.createStore(
        _r._i.reducer,
        _r._i._dS,
        composeEnhancers.apply(
          void 0,
          [redux.applyMiddleware.apply(void 0, easyPeasyMiddleware)].concat(
            enhancers,
          ),
        ),
      );
    }

    store.subscribe(function () {
      _r._i._cS.isInReducer = false;
    });
    _r.dispatch = store.dispatch;
    _r.getState = store.getState;
    _r.ready = store.ready;

    var bindActionCreators = function bindActionCreators() {
      Object.keys(store.dispatch).forEach(function (actionsKey) {
        delete store.dispatch[actionsKey];
      });
      Object.keys(_r._i._aC).forEach(function (key) {
        store.dispatch[key] = _r._i._aC[key];
      });
    };

    bindActionCreators();

    var rebindStore = function rebindStore(removeKey) {
      var currentState = store.getState();

      if (removeKey) {
        delete currentState[removeKey];
      }

      bindStoreInternals(currentState);
      store.replaceReducer(_r._i.reducer);
      replaceState(_r._i._dS);
      bindActionCreators();
    };

    var _resolveRehydration = rehydrateStateFromPersistIfNeeded(
      persistKey,
      replaceState,
      _r,
    );

    return Object.assign(store, {
      addModel: function addModel(key, modelForKey) {
        if (modeldef[key] && process.env.NODE_ENV !== 'production') {
          store.removeModel(key);
        }

        modeldef[key] = modelForKey;
        rebindStore(); // There may have been persisted state for a dynamic model. We should try
        // and rehydrate the specifc node

        var addModelRehydration = rehydrateStateFromPersistIfNeeded(
          persistKey,
          replaceState,
          _r,
          key,
        );
        return {
          resolveRehydration: function resolveRehydration() {
            return addModelRehydration;
          },
        };
      },
      ready: _r.ready,
      clearMockedActions: function clearMockedActions() {
        mockedActions = [];
      },
      getActions: function getActions() {
        return _r._i._aC;
      },
      getListeners: function getListeners() {
        return _r._i._lAC;
      },
      getMockedActions: function getMockedActions() {
        return [].concat(mockedActions);
      },
      persist: {
        clear: persistor.clear,
        flush: persistor.flush,
        resolveRehydration: function resolveRehydration() {
          return _resolveRehydration;
        },
      },
      reconfigure: function reconfigure(newModel) {
        modeldef = bindReplaceState(newModel);
        rebindStore();
      },
      removeModel: function removeModel(key) {
        if (!modeldef[key]) {
          return;
        }

        delete modeldef[key];
        rebindStore(key);
      },
    });
  }

  function createContextStore(model, config) {
    if (config === void 0) {
      config = {};
    }

    // We create a mutable injections reference to allow updating it
    var _config = config,
      _config$injections = _config.injections,
      mutableInjections =
        _config$injections === void 0 ? {} : _config$injections;
    var StoreContext = React.createContext();

    function Provider(_ref) {
      var children = _ref.children,
        runtimeModel = _ref.runtimeModel,
        injections = _ref.injections;

      // If the user provided injections we need to ensure our mutable ref
      // is up to date. We could consider doing a shallow compare here?
      if (injections != null) {
        var nextInjections =
          typeof injections === 'function'
            ? injections(mutableInjections)
            : injections;
        var nextKeys = Object.keys(nextInjections);
        var removeKeys = Object.keys(mutableInjections).filter(function (k) {
          return !nextKeys.includes(k);
        });
        removeKeys.forEach(function (k) {
          delete mutableInjections[k];
        });
        Object.assign(mutableInjections, nextInjections);
      }

      var store = useMemoOne(function () {
        return createStore(
          typeof model === 'function' ? model(runtimeModel) : model,
          _objectSpread__default['default'](
            _objectSpread__default['default']({}, config),
            {},
            {
              originalInjections: mutableInjections,
            },
          ),
        );
      }, []);
      return /*#__PURE__*/ React__default['default'].createElement(
        StoreContext.Provider,
        {
          value: store,
        },
        children,
      );
    }

    function useStore() {
      return React.useContext(StoreContext);
    }

    return {
      Provider: Provider,
      useStore: useStore,
      useStoreState: createStoreStateHook(StoreContext),
      useStoreActions: createStoreActionsHook(StoreContext),
      useStoreDispatch: createStoreDispatchHook(StoreContext),
      useStoreRehydrated: createStoreRehydratedHook(StoreContext),
    };
  }

  /**
   * This file has been copied from redux-persist.
   * The intention being to support as much of the redux-persist API as possible.
   */
  function createTransform(inbound, outbound, config) {
    if (config === void 0) {
      config = {};
    }

    var whitelist = config.whitelist || null;
    var blacklist = config.blacklist || null;

    function whitelistBlacklistCheck(key) {
      if (whitelist && whitelist.indexOf(key) === -1) return true;
      if (blacklist && blacklist.indexOf(key) !== -1) return true;
      return false;
    }

    return {
      in: function _in(data, key, fullState) {
        return !whitelistBlacklistCheck(key) && inbound
          ? inbound(data, key, fullState)
          : data;
      },
      out: function out(data, key, fullState) {
        return !whitelistBlacklistCheck(key) && outbound
          ? outbound(data, key, fullState)
          : data;
      },
    };
  }

  /* eslint-disable react/prop-types */
  function StoreProvider(_ref) {
    var children = _ref.children,
      store = _ref.store;
    return /*#__PURE__*/ React__default['default'].createElement(
      StoreContext.Provider,
      {
        value: store,
      },
      children,
    );
  }

  function useLocalStore(modelCreator, dependencies, configCreator) {
    if (dependencies === void 0) {
      dependencies = [];
    }

    var storeRef = React.useRef();
    var configRef = React.useRef();
    var store = useMemoOne(function () {
      var previousState =
        storeRef.current != null ? storeRef.current.getState() : undefined;
      var config =
        configCreator != null
          ? configCreator(previousState, configRef.current)
          : undefined;

      var _store = createStore(modelCreator(previousState), config);

      configRef.current = config;
      storeRef.current = _store;
      return _store;
    }, dependencies);

    var _useState = React.useState(function () {
        return store.getState();
      }),
      currentState = _useState[0],
      setCurrentState = _useState[1];

    React.useEffect(
      function () {
        return store.subscribe(function () {
          var nextState = store.getState();

          if (currentState !== nextState) {
            setCurrentState(nextState);
          }
        });
      },
      [store],
    );
    return [currentState, store.getActions(), store];
  }

  exports.StoreProvider = StoreProvider;
  exports.action = action;
  exports.actionOn = actionOn;
  exports.alias = alias;
  exports.computed = computed;
  exports.createContextStore = createContextStore;
  exports.createStore = createStore;
  exports.createStoreActionsHook = createStoreActionsHook;
  exports.createStoreDispatchHook = createStoreDispatchHook;
  exports.createStoreRehydratedHook = createStoreRehydratedHook;
  exports.createStoreStateHook = createStoreStateHook;
  exports.createTransform = createTransform;
  exports.createTypedHooks = createTypedHooks;
  exports.debug = debug;
  exports.generic = generic;
  exports.persist = persist;
  exports.reducer = reducer;
  exports.thunk = thunk;
  exports.thunkOn = thunkOn;
  exports.unstable_effectOn = unstable_effectOn;
  exports.useLocalStore = useLocalStore;
  exports.useStore = useStore;
  exports.useStoreActions = useStoreActions;
  exports.useStoreDispatch = useStoreDispatch;
  exports.useStoreRehydrated = useStoreRehydrated;
  exports.useStoreState = useStoreState;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;
})({}, React, _objectSpread, Redux, reduxThunk, immer, webextRedux);
//# sourceMappingURL=index.iife.js.map
