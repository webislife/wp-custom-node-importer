<?php
// ------- Регистрация апи -----------
function jewel_register_custom_fields() {
    register_rest_field('jewels',
        'workPrice',
        array(
            'get_callback' => 'post_get_meta',
            'update_callback' => 'post_set_meta',
            'schema' => array(
                                'description' => 'Цена работы',
                                'type' => 'string',
                                'context' => array('view', 'edit')
                            )
        )
    );
    register_rest_field('jewels',
        'art',
        array(
            'get_callback' => 'post_get_meta',
            'update_callback' => 'post_set_meta',
            'schema' => array(
                                'description' => 'Артикул',
                                'type' => 'string',
                                'context' => array('view', 'edit')
                            )
        )
    );
    register_rest_field('jewels',
        'weight',
        array(
            'get_callback' => 'post_get_meta',
            'update_callback' => 'post_set_meta',
            'schema' => array(
                                'description' => 'Вес',
                                'type' => 'string',
                                'context' => array('view', 'edit')
                            )
        )
    );
}
add_action('rest_api_init', 'jewel_register_custom_fields');

function post_get_meta($post, $field_name, $request) {
  return get_post_meta($post['id'], $field_name);
}
 
function post_set_meta($value, $post, $field_name) {
  if (!$value || !is_string($value)) {
    return;
  }
  return update_post_meta($post->ID, $field_name, strip_tags($value));
}