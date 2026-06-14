<?php

function ecocoleta_senha_tem_numeros_sequenciais(string $senha, int $minRun = 4): bool
{
    if (!preg_match_all('/\d+/', $senha, $matches)) {
        return false;
    }

    foreach ($matches[0] as $run) {
        $len = strlen($run);
        if ($len < $minRun) {
            continue;
        }

        for ($i = 0; $i <= $len - $minRun; $i++) {
            $asc = true;
            $desc = true;

            for ($j = 0; $j < $minRun - 1; $j++) {
                $a = (int) $run[$i + $j];
                $b = (int) $run[$i + $j + 1];
                if ($b !== $a + 1) {
                    $asc = false;
                }
                if ($b !== $a - 1) {
                    $desc = false;
                }
            }

            if ($asc || $desc) {
                return true;
            }
        }
    }

    return false;
}
