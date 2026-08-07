/**
 * Tags the standalone signature paragraph each essay ends with — PUBLIUS on
 * the Federalist side, BRUTUS and CATO on the New-York Journal side — so the
 * stylesheet can set it flush right at the foot of the final column the way
 * the original printings signed the essays. Printed footnotes may follow it.
 */
export const publiusSignaturePlugin = {
  name: 'publius-signature',
  element: {
    filter: ['p'],
    visit(node, ctx) {
      const text = ctx.textContent(node).trim();
      if (text === 'PUBLIUS' || text === 'BRUTUS' || text === 'CATO') {
        ctx.setProperty(node, 'className', ['essay-signature']);
      }
    }
  }
};
