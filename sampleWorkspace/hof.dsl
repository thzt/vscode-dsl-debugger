let a = 1
let b = 2

hof(x){
  let b = 3
  fn(y){
    return y+b
  }
  return fn
}

let func = hof(a)
let yb = func(b)
