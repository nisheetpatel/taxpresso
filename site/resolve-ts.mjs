// A module resolve hook for the website build (build.ts registers it): the rules packages import
// each other's TypeScript files as "./file.js", the way their bundler and tsc read them; Node, which
// runs the build's TypeScript directly, finds no such file. When a relative "./file.js" doesn't
// exist, this tries "./file.ts". Build time only: nothing here ships, nothing here goes online.

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && /^\.{1,2}\/.*\.js$/.test(specifier))
      return next(specifier.replace(/\.js$/, '.ts'), context);
    throw error;
  }
}
