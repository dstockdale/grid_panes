defmodule GridPanes.Grids.Pane do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :id, :string
    field :type, Ecto.Enum, values: [:pane, :group, :divider]
    field :direction, Ecto.Enum, values: [:row, :column]

    field :size, :decimal
    field :size_default, :decimal
    field :size_unit, Ecto.Enum, values: [:px, :fr, :auto], default: :fr
    field :size_min, :integer
    field :size_max, :integer

    field :collapsible, :boolean, default: false
    field :collapse_at, :integer
    field :collapse_to, :integer

    field :divider_position, Ecto.Enum, values: [:none, :start, :end], default: :none
    field :divider_size, :integer, default: 8

    # Hierarchical structure
    field :parent_id, :string
    field :children, {:array, :string}, default: []
    field :order, :integer
  end

  @doc false
  def changeset(pane, attrs) do
    pane
    |> cast(attrs, [
      :id,
      :type,
      :direction,
      :size,
      :size_unit,
      :size_default,
      :size_min,
      :size_max,
      :collapsible,
      :collapse_at,
      :collapse_to,
      :divider_position,
      :divider_size,
      :parent_id,
      :children,
      :order
    ])
    |> validate_required([:id, :type])
    |> validate_id_format(:id)
    |> validate_size_default()
    |> validate_size_consistency()
    |> validate_required_if(:direction, %{field: :type, value: :group})
    |> validate_required_if([:size_default, :size_unit], %{field: :type, value: :pane})
    |> validate_children_structure()
    |> validate_min_max_sizes()
  end

  def type_options do
    [
      {"Pane", :pane},
      {"Group", :group}
    ]
  end

  def direction_options do
    [
      {nil, nil},
      {"Row", :row},
      {"Column", :column}
    ]
  end

  defp validate_required_if(changeset, field, opts) when is_list(field) do
    cond do
      get_field(changeset, opts[:field]) == opts[:value] ->
        validate_required(changeset, field)

      true ->
        changeset
    end
  end

  defp validate_required_if(changeset, field, opts) do
    cond do
      get_field(changeset, opts[:field]) == opts[:value] ->
        validate_required(changeset, field)

      true ->
        changeset
    end
  end

  defp validate_id_format(changeset, field) do
    case get_field(changeset, field) do
      nil ->
        changeset

      id ->
        if String.match?(id, ~r/^[a-z][a-z0-9_-]*$/) do
          changeset
        else
          add_error(
            changeset,
            field,
            "must start with a lowercase letter and contain only lowercase letters, numbers, dashes, and underscores"
          )
        end
    end
  end

  defp validate_children_structure(changeset) do
    type = get_field(changeset, :type)
    children = get_field(changeset, :children) || []

    case type do
      :group when children == [] ->
        add_error(changeset, :children, "groups must have at least one child")

      :pane when children != [] ->
        add_error(changeset, :children, "panes cannot have children")

      _ ->
        changeset
    end
  end

  # Validate that size values are consistent with the unit
  defp validate_size_consistency(changeset) do
    size_default = get_field(changeset, :size_default)
    size_unit = get_field(changeset, :size_unit)

    case {size_default, size_unit} do
      # auto doesn't need a value
      {nil, :auto} ->
        changeset

      {nil, nil} ->
        changeset

      {nil, _unit} ->
        add_error(changeset, :size_default, "size value required when unit is specified")

      {_value, nil} ->
        add_error(changeset, :size_unit, "size unit required when default is specified")

      {value, unit} when unit in [:px, :fr] ->
        if Decimal.positive?(value) do
          changeset
        else
          add_error(changeset, :size, "#{unit} values must be positive")
        end

      _ ->
        changeset
    end
  end

  defp validate_size_default(changeset) do
    size = get_field(changeset, :size)
    size_default = get_field(changeset, :size_default)

    if is_nil(size) && not is_nil(size_default) do
      put_change(changeset, :size, size_default)
    else
      changeset
    end
  end

  # Validate min/max size relationships
  defp validate_min_max_sizes(changeset) do
    min_value = get_field(changeset, :min_size)
    max_value = get_field(changeset, :max_size)

    cond do
      min_value && max_value && min_value > max_value ->
        add_error(changeset, :min_size, "minimum size cannot be greater than maximum size")

      true ->
        changeset
    end
  end

  def size_unit_options do
    [
      {"Pixels (px)", :px},
      {"Fraction (fr)", :fr},
      {"Auto", :auto}
    ]
  end

  # Helper function to get the full size string for CSS
  def size_string(%__MODULE__{size_unit: :auto}), do: "auto"
  def size_string(%__MODULE__{size_default: nil}), do: nil

  def size_string(%__MODULE__{size_default: value, size_unit: unit}) do
    case unit do
      :px -> "#{Decimal.to_string(value)}px"
      :fr -> format_fr_value(value)
    end
  end

  defp format_fr_value(value) do
    if Decimal.equal?(value, Decimal.round(value, 0)) do
      "#{Decimal.to_integer(value)}fr"
    else
      "#{Decimal.to_string(value)}fr"
    end
  end

  def divider_position_options do
    [
      {"None", :none},
      {"Start", :start},
      {"End", :end}
    ]
  end

  # Helper function to get divider size string for CSS
  def divider_size_string(%__MODULE__{divider_position: :none}), do: nil
  def divider_size_string(%__MODULE__{divider_size: nil}), do: nil

  def divider_size_string(%__MODULE__{divider_size: size}) do
    "#{Decimal.to_string(size)}px"
  end

  # Helper to create a new decimal value
  def new_decimal(value) when is_binary(value), do: Decimal.new(value)
  def new_decimal(value) when is_integer(value), do: Decimal.new(value)
  def new_decimal(value) when is_float(value), do: Decimal.from_float(value)
  def new_decimal(%Decimal{} = value), do: value
end
