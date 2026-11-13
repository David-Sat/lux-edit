import { SourceLocation } from '@visual-edit/core';

interface ReactFiberType {
  displayName?: string;
  name?: string;
  render?: { name?: string };
}

interface ReactFiberNode {
  type?: ReactFiberType | string | null;
  _debugSource?: {
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  return?: ReactFiberNode | null;
}

export function resolveReactSource(element: HTMLElement): Partial<SourceLocation> | null {
  try {
    const fiberKey = Object.keys(element).find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
    if (!fiberKey) return null;

    let fiber: ReactFiberNode | null | undefined = (
      element as unknown as Record<string, ReactFiberNode | undefined>
    )[fiberKey];
    let sourceLoc: Partial<SourceLocation> | null = null;
    let componentName: string | undefined;

    while (fiber) {
      if (!componentName && fiber.type && typeof fiber.type !== 'string') {
        componentName = fiber.type.displayName || fiber.type.name || fiber.type.render?.name;
      }

      if (fiber._debugSource) {
        sourceLoc = {
          fileName: fiber._debugSource.fileName,
          lineNumber: fiber._debugSource.lineNumber,
          columnNumber: fiber._debugSource.columnNumber,
          componentName: componentName || 'UnknownComponent',
          framework: 'react',
        };
        break;
      }

      fiber = fiber.return;
    }

    if (sourceLoc) return sourceLoc;
    if (componentName) {
      return {
        componentName,
        framework: 'react',
      };
    }
  } catch (err) {
    console.debug('[visual-edit] Failed to resolve React Fiber source:', err);
  }

  return null;
}
