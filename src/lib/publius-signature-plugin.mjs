/**
 * Tags the standalone PUBLIUS paragraph each essay ends with, so the
 * stylesheet can set it flush right at the foot of the final column the way
 * the original printings signed the essays. Printed footnotes may follow it.
 */
export const publiusSignaturePlugin = {
  name: 'publius-signature',
  element: {
    filter: ['p'],
    visit(node, ctx) {
      if (ctx.textContent(node).trim() === 'PUBLIUS') {
        ctx.setProperty(node, 'className', ['essay-signature']);
      }
    }
  }
};
