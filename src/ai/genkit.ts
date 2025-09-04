type AnyFunction = (...args: any[]) => any;

const definePrompt = (config: any): AnyFunction => {
  const fn: AnyFunction = async (input: any) => {
    return { output: input };
  };
  (fn as any).__config = config;
  return fn;
};

const defineFlow = (_config: any, handler: AnyFunction): AnyFunction => {
  return handler;
};

export const ai = { defineFlow, definePrompt };


