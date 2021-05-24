const PENDING = 'Pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

class MyPromise {
  constructor(fn) {
    this._status = PENDING
    this._value = undefined
    this._reason = undefined
    this._fulfilledCbs = []
    this._rejectedCbs = []

    try {
      // fn 立即执行
      fn(this.resolve, this.reject)
    } catch(err) {
      this.reject(err)
    }
  }

  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value
    onRejected = typeof onRejected === 'function' ? onRejected : error => { throw error }

    const newPromise = new MyPromise((nextResolve, nextReject) => {
      const fulfilledCb = () => {
        queueMicrotask(() => {
          try {
            const res = onFulfilled(this._value)
            resolvePromise(newPromise, res, nextResolve, nextReject)
          } catch(err) {
            nextReject(err)
          }
        })
      }
      const rejectedCb = () => {
        queueMicrotask(() => {
          try {
            const res = onRejected(this._reason)
            resolvePromise(newPromise, res, nextResolve, nextReject)
          } catch(err) {
            nextReject(err)
          }
        })
      }

      if (this._status === PENDING) {
        this._fulfilledCbs.push(fulfilledCb)
        this._rejectedCbs.push(rejectedCb)
      } else if (this._status === FULFILLED) {
        fulfilledCb()
      } else {
        rejectedCb()
      }
    })

    return newPromise
  }

  resolve = (value) => {
    if (this._status === PENDING) {
      this._status = FULFILLED
      this._value = value
      while(this._fulfilledCbs.length) {
        (this._fulfilledCbs.shift())()
      }
    }
  }

  reject = (error) => {
    if (this._status === PENDING) {
      this._status = REJECTED
      this._reason = error
      while(this._rejectedCbs.length) {
        (this._rejectedCbs.shift())()
      }
    }
  }

  catch(onReject) {
    this.then(undefined, onReject)
  }

  finally(onFinished) {
    // 回调函数没有参数
    this.then(value => {
      onFinished()
      return value
    }, reason => {
      onFinished()
      return reason
    })
  }

  static resolve(value) {
    // 如果传入 MyPromise 就直接返回
    if (value instanceof MyPromise) {
      return value
    }

    // 转成常规方式
    return new MyPromise(resolve =>  {
      resolve(value)
    })
  }

  static reject(error) {
    return new MyPromise((resolve, reject) => {
      reject(error)
    })
  }

  static all(iterator) {
    const list = Array.from(iterator)

    return new MyPromise((resolve, reject) => {
      const result = []
      const length = list.length
      let count = 0

      if (length === 0) {
        return resolve(result)
      }

      list.forEach((promise, index) => {
        MyPromise.resolve(promise).then(value => {
          result[index] = value

          if (++count === length) {
            resolve(result)
          }
        }, reason => {
          reject(reason)
        })
      })
    })
  }

  static allSettled(iterator) {
    const list = Array.from(iterator)

    return new MyPromise((resolve, reject) => {
      const result = []
      const length = list.length
      let count = 0

      if (length === 0) {
        return resolve(result)
      }

      list.forEach((promise, index) => {
        MyPromise.resolve(promise).then(value => {
          result[index] = {
            status: 'fulfilled',
            value
          }

          if (++count === length) {
            resolve(result)
          }
        }, reason => {
          result[index] = {
            status: 'rejected',
            reason: reason
          }

          if (++count === length) {
            resolve(result)
          }
        })
      })
    })
  }

  static race(iterator) {
    const list = Array.from(iterator)

    return new MyPromise((resolve, reject) => {
      list.forEach(promise => {
        MyPromise.resolve(promise).then(value => {
          resolve(value)
        }, reason => {
          reject(reason)
        })
      })
    })
  }
}

function resolvePromise(newPromise, res, nextResolve, nextReject) {
  if (newPromise === res) {
    return nextReject(new TypeError('error'))
  }
  
  if (
    (typeof res === 'object' && res !== null) ||
    typeof res === 'function'
  ) {
    let then
    try {
      then = res.then
    } catch(err) {
      nextReject(err)
    }

    if (typeof then === 'function') {
      let called = false
      try {
        then.call(
          res,
          nextRes => {
            if (called) return
            called = true
            resolvePromise(newPromise, nextRes, nextResolve, nextReject)
          },
          nextErr => {
            if (called) return
            called = true
            nextReject(nextErr)
          }
        )
      } catch(err) {
        if (called) return
        nextReject(err)
      }
    } else {
      nextResolve(res)
    }
  } else {
    nextResolve(res)
  }
}

// 用于 Promise/A+ 规范测试
MyPromise.deferred = function () {
  var result = {};
  result.promise = new MyPromise(function (resolve, reject) {
    result.resolve = resolve;
    result.reject = reject;
  });

  return result;
}


module.exports = MyPromise
