const base = require("./app.json").expo;

module.exports = () => {
  const isBeta = process.env.APP_VARIANT === "beta";

  return {
    ...base,
    name: isBeta ? "UltimoTurno Beta" : base.name,
    android: {
      ...base.android,
      package: isBeta ? "com.ultimoturno.app.beta" : base.android.package
    },
    ios: {
      ...base.ios,
      bundleIdentifier: isBeta ? "com.ultimoturno.app.beta" : base.ios.bundleIdentifier
    },
    extra: {
      ...base.extra,
      buildVariant: isBeta ? "beta" : "production"
    }
  };
};
