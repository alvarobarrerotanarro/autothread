const usersURL = "https://dummyjson.com/users";
function fibonacci(num) {
    if (num < 2)
        return num;
    return fibonacci(num - 1) + fibonacci(num - 2);
}
export default {
    // Healthcheck
    greet() {
        return { ok: true, value: "Hello World !" };
    },
    // Heavy work
    fibonacci(num) {
        if (num > 50) {
            return { ok: false, error: "Too heavy calculus." };
        }
        return { ok: true, value: fibonacci(num) };
    },
    // Event loop microtask saturation. 
    async countPeopleEyeColor(color) {
        try {
            const req = await fetch(usersURL);
            const data = await req.json();
            let counter = 0;
            for (let user of data.users) {
                if (user.eyeColor.toLowerCase() == color)
                    counter++;
            }
            return { ok: true, value: counter };
        }
        catch (error) {
            return { ok: false, error: error.message || String(error) };
        }
    }
};
//# sourceMappingURL=routines.js.map