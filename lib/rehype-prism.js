import rehypePrism from 'rehype-prism-plus'
import refractor from 'refractor/core'

// Import and register missing languages
import cpp from 'refractor/lang/cpp.js'
import powershell from 'refractor/lang/powershell.js'
import ocaml from 'refractor/lang/ocaml.js'

refractor.register(cpp)
refractor.register(powershell)
refractor.register(ocaml)

export default rehypePrism
