import rehypePrism from 'rehype-prism-plus'
import refractor from 'refractor/core'

import cpp from 'refractor/lang/cpp'
import ocaml from 'refractor/lang/ocaml'
import powershell from 'refractor/lang/powershell'

refractor.register(cpp)
refractor.register(ocaml)
refractor.register(powershell)

export default rehypePrism
