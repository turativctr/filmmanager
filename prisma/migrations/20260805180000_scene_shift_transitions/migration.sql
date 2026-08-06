-- Import de PDF: cenas de roteiro podem atravessar de um período pro outro dentro da mesma
-- cena ("NOITE PARA DIA"/"DIA PARA NOITE"), com consequência real de produção (luz de dois
-- momentos distintos). Só adiciona valores ao enum — nenhum dado existente muda.
ALTER TYPE "SceneShift" ADD VALUE 'NOITE_PARA_DIA';
ALTER TYPE "SceneShift" ADD VALUE 'DIA_PARA_NOITE';
