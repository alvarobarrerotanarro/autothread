export default {
  greet() {
    return "Hello World !";
  },

  fibonacci(num: number): number {
    if (num-2 < 0)
      return num;
    return this.fibonacci(num - 1) + this.fibonacci(num - 2);
  }
};