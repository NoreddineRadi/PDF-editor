import Button from 'primevue/button'
import Toolbar from 'primevue/toolbar'
import Menubar from 'primevue/menubar'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import Tooltip from 'primevue/tooltip'
import Toast from 'primevue/toast'
import Dialog from 'primevue/dialog'
import FileUpload from 'primevue/fileupload'
import ProgressSpinner from 'primevue/progressspinner'
import Divider from 'primevue/divider'
import ToggleButton from 'primevue/togglebutton'

export function installPrimeVueComponents(app) {
  app
    .component('Button', Button)
    .component('Toolbar', Toolbar)
    .component('Menubar', Menubar)
    .component('Splitter', Splitter)
    .component('SplitterPanel', SplitterPanel)
    .component('InputNumber', InputNumber)
    .component('SelectButton', SelectButton)
    .component('Toast', Toast)
    .component('Dialog', Dialog)
    .component('FileUpload', FileUpload)
    .component('ProgressSpinner', ProgressSpinner)
    .component('Divider', Divider)
    .component('ToggleButton', ToggleButton)
    .directive('tooltip', Tooltip)
}
