import React from 'react';
import { render } from 'react-dom';
import { classUseState, fc } from './classHook';

const App = fc(function app() {
  const [text, setText] = classUseState('这是app')

  return (
    <div>
      <h1>{text}</h1>
      <button onClick={() => setText('这是点击之后的标题')}>
        更新标题
      </button>
    </div>
  )
}, 'App')

render(<App/>, document.getElementById('app'))

