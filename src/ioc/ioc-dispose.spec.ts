#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/* eslint-disable sort-keys */

import {
  test,
  sinon,
}                   from 'tstest'

import {
  Disposable,
  createInjector,
}                   from 'typed-inject'

test('dispose()', async t => {
  const spy = sinon.spy()

  enum InjectionToken {
    Foo = 'Foo'
  }

  function fooFactory (): Disposable {
    spy('fooFactory()')
    return {
      dispose: () => {
        spy('~fooFactory()')
      },
    }
  }

  const injector = createInjector()
    .provideFactory(InjectionToken.Foo, fooFactory)

  test.inject = [InjectionToken.Foo] as const
  function test (foo: Object) {
    void foo
    spy('test()')
  }

  injector.injectFunction(test)
  await injector.dispose()

  t.same(spy.args, [
    [ 'fooFactory()' ],
    [ 'test()' ],
    [ '~fooFactory()' ]
  ], 'should dispose all factories')
})
