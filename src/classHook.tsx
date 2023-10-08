import React from 'react';
import { v4 as genUuid } from 'uuid';

type CacheNode = {
  currentValue: any;
  next: CacheNode | null;
}

const generateEmptyCacheNode = (value?: any): CacheNode => ({
  currentValue: value,
  next: null
})

let targetComponent: null | FC<any> = null;

const cache: Record<string, {
  current: CacheNode;
  cache: CacheNode;
}> = {}

const dirtyComponentId: string[] = [];

const shouldInitState = (instance: FC<any>) => {
  return !instance.stateBeenInitial;
}
const initState = (uuid: string, value: any) => {
  if (!cache[uuid]) {
    const emptyCacheNode = generateEmptyCacheNode(value);
    cache[uuid] = {
      current: emptyCacheNode,
      cache: emptyCacheNode,
    }
  } else {
    const cacheStore = cache[uuid];
    cacheStore.cache.next = generateEmptyCacheNode(value);
    cacheStore.current = cacheStore.cache.next
  }
}
const getCache = (uuid: string) => {
  const cacheStore = cache[uuid];
  const value = cacheStore.current
  cacheStore.current = cacheStore.cache.next || {
    currentValue: null,
    next: null,
  };
  return value;
}
const updateCache = (cacheNode: CacheNode, value: any) => {
  cacheNode.currentValue = value;
}

const renderer: {
  renderQueue: FC<any>[];
  notifyUpdated: (instance: FC<any>) => void;
} = {
  renderQueue: [],
  notifyUpdated: (instance: FC<any>) => {
    if (!renderer.renderQueue.some(e => e.uuid === instance.uuid)) {
      if (!dirtyComponentId.includes(instance.uuid)) {
        dirtyComponentId.push(instance.uuid);
      }
      Promise.resolve().then(() => {
        if (dirtyComponentId.includes(instance.uuid)) {
          instance.update();
        }
      })
    }
  }
}

abstract class FC<P, SS = any> extends React.PureComponent<P, {
  renderMark: number;
}, SS> {
  abstract uuid: string;
  abstract fc: (props: P, context?: SS) => React.ReactNode;
  state = {
    renderMark: 0,
  }
  stateBeenInitial = false
  update = () => {
    this.setState(origin => ({
      renderMark: 1 - origin.renderMark
    }), this.removeFromDirty)
  }
  setStateInitial = () => {
    if (!this.stateBeenInitial) {
      this.stateBeenInitial = true;
    }
  }
  setStateCurrentTop = () => {
    if (this.stateBeenInitial) {
      const cacheStore = cache[this.uuid];
      cacheStore.current = cacheStore.cache;
    }
  }
  removeFromDirty = () => {
    const dirtyIndex = dirtyComponentId.findIndex(id => id === this.uuid)
    if (dirtyIndex > -1) {
      dirtyComponentId.splice(dirtyIndex, 1);
    }
    if (renderer.renderQueue.includes(this)) {
      renderer.renderQueue = renderer.renderQueue.filter(e => e.uuid !== this.uuid)
    }
  }
  componentWillUnmount = () => {
    this.removeFromDirty();
    delete cache[this.uuid];
  }
  render() {
    const { props, context } = this;
    targetComponent = this;
    this.setStateCurrentTop();
    const node = this.fc(props, context);
    this.setStateInitial();
    targetComponent = null;
    return node
  }
}

export const fc = <P extends object, C extends object = any>(
  functionComponent: (props: P, context?: C) => React.ReactNode,
  displayName?: string
) => {
  class F extends FC<P, C> {
    static displayName: string;
    uuid = genUuid();

    fc = functionComponent
  }
  F.displayName = functionComponent.name || displayName || '';
  return F
}

export const classUseState = <S extends any>(initialState: S) => {
  const instance = targetComponent
  if (!instance) {
    throw('using hooks outside component are not permitted')
  }
  const { uuid } = instance
  const shouldInitial = shouldInitState(instance);
  if (shouldInitial) {
    initState(uuid, initialState);
  }
  const cacheNode = getCache(uuid);
  const state = cacheNode.currentValue;

  const updateState = (newState: S): void => {
    const oldState = cacheNode.currentValue;
    if (Object.is(oldState, newState)) return
    updateCache(cacheNode, newState);
    renderer.notifyUpdated(instance)
  }

  return [state, updateState] as const
}


