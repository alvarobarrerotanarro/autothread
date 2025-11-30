export default {
    greet() {
        return "Hello World !";
    },
    fibonacci(num) {
        if (num - 2 < 0)
            return num;
        return this.fibonacci(num - 1) + this.fibonacci(num - 2);
    }
};
//# sourceMappingURL=routines.js.map