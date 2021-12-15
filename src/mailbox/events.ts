import {
  createAction,
}                         from 'typesafe-actions'

import * as types from './types.js'

const payloadDispatch = () => ({})
const payloadIdle  = () => ({})
const payloadReset = () => ({})

const DISPATCH = createAction(types.DISPATCH, payloadDispatch)()
const IDLE  = createAction(types.IDLE, payloadIdle)()
const RESET = createAction(types.RESET, payloadReset)()

export {
  DISPATCH,
  IDLE,
  RESET,
}
