let a = 1
let b = 2

f(x){
  let b = 3
  g(y){
    return y+b
  }
  return g
}

let c = f(a)
let d = c(b)
