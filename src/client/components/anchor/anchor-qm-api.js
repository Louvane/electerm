/** quickCommands CRUD(委托 electerm Store 原型方法) */
import generate from '../../common/uid.js'

export function addQuickCommand (store, qm) {
  store.addQuickCommand({ id: generate(), ...qm })
}
export function editQuickCommand (store, id, update) {
  store.editQuickCommand(id, update)
}
export function delQuickCommand (store, { id }) {
  store.delQuickCommand({ id })
}
