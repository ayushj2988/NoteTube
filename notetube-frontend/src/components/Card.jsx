// A card. It lifts when you hover it and presses in when you click it (the CSS does that).
//   as         the tag to draw: 'div' (default), 'form', 'button', or a router Link
//   className  extra classes ('hero', 'fc', 'lg' ...)
export default function Card({ as: Tag = 'div', className = '', big, children, ...rest }) {
  void big
  return <Tag className={'cd' + (className ? ' ' + className : '')} {...rest}>{children}</Tag>
}
