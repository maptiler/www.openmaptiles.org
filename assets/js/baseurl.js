// Prefix the site's baseurl onto a root-absolute in-site path.
//
// _plugins/baseurl.rb does this for rendered output, but only for src= and href=
// in .html — it never sees these files. So any in-site URL that JS builds has to
// carry the prefix itself, and five did not: the hero's style-preview
// click-through and dialog close, the style modal's open and close pushState, and
// the viewers modal's close. All five resolved against the domain root.
//
// Invisible in production, where baseurl is "" and a root-absolute path is already
// correct. On the labs staging deployment, served under /www.openmaptiles.org/,
// each one navigated or rewrote the URL clean off the build being tested.
//
// Takes the parsed #site-config object rather than the string so call sites read
// the same way whether or not they already destructured it.
export const withBase = (config, path) => `${(config && config.baseurl) || ""}${path}`;
