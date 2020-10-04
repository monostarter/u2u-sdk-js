module.exports = {
    alias: {
        // redirect src/ to src/browser
        // note that this is NOT needed when consuming this package as the browser field in package.json
        // will take care of this
        "../src": "../src/browser",
    },
    optimizeDeps: {
        // excludes the package from web bundling optimizations
        // this will almost certainly break the package and should only be used for packages that
        // are only imported in node.js
        exclude: ["@grpc/grpc-js"],
        // allows the package to _reference_ node builtins statically as long as the code branches
        // that use them are never reached
        allowNodeBuiltins: ["@hashgraph/cryptography"],
    },
};
