import { Shader } from '@editor/model/Shader';
import { HTMLAttributes, forwardRef } from 'react';

const ShaderPreview = forwardRef<
  HTMLDivElement,
  {
    shader: Shader;
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
