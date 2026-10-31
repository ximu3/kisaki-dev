/**
 * @fileoverview Exposes shared Solid controls, dialog composition, and virtual geometry
 * while leaving business data and view state to consumers.
 */

export { Button } from './components/button'
export type { ButtonProps } from './components/button'
export {
  TextField,
  TextFieldLabel,
  TextFieldDescription,
  TextFieldErrorMessage,
  TextFieldInput,
  TextFieldTextArea,
} from './components/text-field'
export type {
  TextFieldProps,
  TextFieldInputProps,
  TextFieldTextAreaProps,
  TextFieldLabelProps,
} from './components/text-field'
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
  DialogContent,
} from './components/dialog'
export type { DialogProps, DialogContentProps, DialogCloseRequest } from './components/dialog'
export { createVirtualizer, createWindowVirtualizer, defaultRangeExtractor } from './virtual'
export type {
  Virtualizer,
  VirtualizerOptions,
  VirtualItem,
  Range,
  ScrollToOptions,
} from './virtual'
