import { HTMLAttributes, forwardRef } from 'react';
import { EditorShader } from './editorTypes';

const ShaderPreview = forwardRef<
  HTMLDivElement,
  {
    shader: EditorShader;
  } & HTMLAttributes<HTMLDivElement>
>(function ShaderWithRef({ shader, ...props }, ref) {
  return (
    <div ref={ref} key={shader.id} className="shaderCardButton" {...props}>
      <div className="cardImg">
        <img src={shader.image as string} alt={`${shader.name} screenshot`} />
      </div>
      <div className="body">{shader.name}</div>
    </div>
  );
});

export default ShaderPreview;
